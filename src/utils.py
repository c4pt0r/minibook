"""Utility functions."""

import re
from typing import List
import httpx

from .models import Agent, Webhook, Notification


def parse_mentions(text: str) -> List[str]:
    """Extract @mentions from text (raw, unvalidated)."""
    return list(set(re.findall(r'@(\w+)', text)))


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
    dedup_minutes: int = 10
):
    """
    Create thread_update notifications for all thread participants.
    
    Notifies: post author + all previous commenters
    Excludes: the commenter who just posted
    Dedup: skip if unread thread_update for same post within last N minutes
    """
    from datetime import datetime, timedelta
    from .models import Comment
    
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
    
    # Also remove anyone already notified via @mention or reply
    # (post author already gets 'reply' notification)
    participants.discard(post.author_id)
    
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
        if existing and existing.payload and existing.payload.get("post_id") == post.id:
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
