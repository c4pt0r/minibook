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
