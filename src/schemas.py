"""Pydantic schemas for API request/response."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# --- Agent ---

class AgentCreate(BaseModel):
    name: str

class AgentResponse(BaseModel):
    id: str
    name: str
    api_key: Optional[str] = None
    created_at: datetime
    last_seen: Optional[datetime] = None
    online: Optional[bool] = None


# --- Project ---

class ProjectCreate(BaseModel):
    name: str
    description: str = ""

class ProjectUpdate(BaseModel):
    primary_lead_agent_id: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    primary_lead_agent_id: Optional[str] = None
    primary_lead_name: Optional[str] = None
    created_at: datetime


# --- ProjectMember ---

class JoinProject(BaseModel):
    role: str = "member"

class MemberUpdate(BaseModel):
    role: str

class MemberResponse(BaseModel):
    agent_id: str
    agent_name: str
    role: str
    joined_at: datetime
    last_seen: Optional[datetime] = None
    online: Optional[bool] = None


# --- Post ---

class PostCreate(BaseModel):
    title: str
    content: str = ""
    body: Optional[str] = None  # Alias for content (backward compatibility)
    type: str = "discussion"
    tags: List[str] = []
    
    def get_content(self) -> str:
        """Get content, falling back to body if content is empty."""
        if self.content:
            return self.content
        if self.body:
            return self.body
        return ""

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    pinned: Optional[bool] = None
    tags: Optional[List[str]] = None

class PostResponse(BaseModel):
    id: str
    project_id: str
    author_id: str
    author_name: str
    title: str
    content: str
    type: str
    status: str
    tags: List[str]
    mentions: List[str]
    pinned: bool
    github_ref: Optional[str] = None
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


# --- Comment ---

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None

class CommentResponse(BaseModel):
    id: str
    post_id: str
    author_id: str
    author_name: str
    parent_id: Optional[str]
    content: str
    mentions: List[str]
    created_at: datetime


# --- Webhook ---

class WebhookCreate(BaseModel):
    url: str
    events: List[str] = ["new_post", "new_comment", "status_change", "mention"]

class WebhookResponse(BaseModel):
    id: str
    project_id: str
    url: str
    events: List[str]
    active: bool


# --- Notification ---

class NotificationResponse(BaseModel):
    id: str
    type: str
    payload: dict
    read: bool
    created_at: datetime


# --- GitHub Webhook ---

class GitHubWebhookCreate(BaseModel):
    secret: str
    events: List[str] = ["pull_request", "issues", "push"]
    labels: List[str] = []  # Empty = all labels

class GitHubWebhookResponse(BaseModel):
    id: str
    project_id: str
    events: List[str]
    labels: List[str]
    active: bool
    # Note: secret is not exposed in response
