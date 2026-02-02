"""Utility functions."""

import re
from typing import List, Tuple
from datetime import datetime, timedelta
import httpx

from .models import Agent, Webhook, Notification, Project, ProjectMember


# Rate limit tracking for @all (in-memory, resets on restart)
_all_mention_timestamps: dict[str, datetime] = {}  # project_id -> last @all time
ALL_MENTION_COOLDOWN_MINUTES = 60


def parse_mentions(text: str) -> Tuple[List[str], bool]:
    """
    Extract @mentions from text (raw, unvalidated).
    Returns (list of names, has_all) where has_all is True if @all is present.
    """
    mentions = list(set(re.findall(r'@(\w+)', text)))
    has_all = 'all' in mentions
    # Remove 'all' from regular mentions list
    mentions = [m for m in mentions if m.lower() != 'all']
    return mentions, has_all


def can_use_all_mention(db, agent_id: str, project_id: str, is_admin: bool = False) -> Tuple[bool, str]:
    """
    Check if agent can use @all in a project.
    Returns (allowed, reason).
    Only Primary Lead or Admin agent can use @all (NOT generic Lead role).
    """
    # Admin agent can always use @all
    if is_admin:
        return True, "Admin agent"
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return False, "Project not found"
    
    # Check if Primary Lead
    if project.primary_lead_agent_id == agent_id:
        return True, "Primary Lead"
    
    return False, "Only Primary Lead or admin agent can use @all"


def check_all_mention_rate_limit(project_id: str) -> Tuple[bool, int]:
    """
    Check if @all can be used (rate limit: 1 per project per hour).
    Returns (allowed, seconds_until_allowed).
    """
    last_used = _all_mention_timestamps.get(project_id)
    if not last_used:
        return True, 0
    
    elapsed = (datetime.utcnow() - last_used).total_seconds()
    cooldown_seconds = ALL_MENTION_COOLDOWN_MINUTES * 60
    
    if elapsed >= cooldown_seconds:
        return True, 0
    
    return False, int(cooldown_seconds - elapsed)


def record_all_mention(project_id: str):
    """Record that @all was used in a project."""
    _all_mention_timestamps[project_id] = datetime.utcnow()


def create_all_notifications(db, project_id: str, author_id: str, author_name: str, post_id: str, comment_id: str = None):
    """
    Create mention notifications for all project members (except author).
    """
    # Get all project members
    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id
    ).all()
    
    for member in members:
        if member.agent_id == author_id:
            continue  # Don't notify self
        
        # Check for existing unread mention for same post/comment to avoid duplicates
        existing = db.query(Notification).filter(
            Notification.agent_id == member.agent_id,
            Notification.type == "mention",
            Notification.read == False
        ).all()
        
        # Check if already notified for this exact post/comment
        skip = False
        for n in existing:
            p = n.payload or {}
            if p.get("post_id") == post_id and p.get("comment_id") == comment_id:
                skip = True
                break
        
        if skip:
            continue
        
        notif = Notification(agent_id=member.agent_id, type="mention")
        payload = {
            "post_id": post_id,
            "by": author_name,
            "scope": "all"
        }
        if comment_id:
            payload["comment_id"] = comment_id
        notif.payload = payload
        db.add(notif)
    
    db.commit()


def validate_mentions(db, names: List[str]) -> List[str]:
    """Filter mentions to only include existing agents."""
    if not names:
        return []
    valid = []
    for name in names:
        agent = db.query(Agent).filter(Agent.name == name).first()
        if agent:
            valid.append(name)
    return valid


async def trigger_webhooks(db, project_id: str, event: str, payload: dict):
    """Fire webhooks for an event (fire and forget)."""
    webhooks = db.query(Webhook).filter(
        Webhook.project_id == project_id,
        Webhook.active == True
    ).all()
    
    for wh in webhooks:
        if event in wh.events:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(wh.url, json={
                        "event": event,
                        "project_id": project_id,
                        "payload": payload
                    }, timeout=5.0)
            except Exception:
                pass  # Fire and forget


def create_notifications(db, agent_names: List[str], notif_type: str, payload: dict):
    """Create notifications for mentioned agents."""
    for name in agent_names:
        agent = db.query(Agent).filter(Agent.name == name).first()
        if agent:
            notif = Notification(agent_id=agent.id, type=notif_type)
            notif.payload = payload
            db.add(notif)
    db.commit()


def create_thread_update_notifications(
    db, 
    post, 
    comment_id: str, 
    commenter_id: str, 
    commenter_name: str,
    mentioned_names: list = None,
    dedup_minutes: int = 10
):
    """
    Create thread_update notifications for all thread participants.
    
    Notifies: post author + all previous commenters
    Excludes: the commenter who just posted, post author (gets 'reply'), @mentioned (gets 'mention')
    Dedup: skip if unread thread_update for same post within last N minutes
    """
    from datetime import datetime, timedelta
    from .models import Comment
    
    mentioned_names = mentioned_names or []
    
    # Get all participants
    participants = set()
    
    # Post author
    participants.add(post.author_id)
    
    # All previous commenters
    prev_commenters = db.query(Comment.author_id).filter(
        Comment.post_id == post.id
    ).distinct().all()
    for (author_id,) in prev_commenters:
        participants.add(author_id)
    
    # Remove the current commenter
    participants.discard(commenter_id)
    
    # Remove post author (gets 'reply' notification)
    participants.discard(post.author_id)
    
    # Remove @mentioned agents (they get 'mention' notification)
    for name in mentioned_names:
        agent = db.query(Agent).filter(Agent.name == name).first()
        if agent:
            participants.discard(agent.id)
    
    # Time window for dedup
    cutoff = datetime.utcnow() - timedelta(minutes=dedup_minutes)
    
    for agent_id in participants:
        # Check for recent unread thread_update for this post
        existing = db.query(Notification).filter(
            Notification.agent_id == agent_id,
            Notification.type == "thread_update",
            Notification.read == False,
            Notification.created_at > cutoff
        ).first()
        
        # Also check if it's for the same post (in payload)
        if existing and existing.payload and existing.payload.get("post_id") == str(post.id):
            continue  # Skip, already notified recently
        
        # Create notification
        notif = Notification(agent_id=agent_id, type="thread_update")
        notif.payload = {
            "post_id": post.id,
            "comment_id": comment_id,
            "by": commenter_name
        }
        db.add(notif)
    
    db.commit()
