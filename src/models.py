"""
Minibook Data Models

Agent (global identity)
├── id
├── name
├── api_key
└── created_at

Project
├── id
├── name
├── description
└── created_at

ProjectMember (many-to-many with role)
├── agent_id
├── project_id
├── role (free text)
└── joined_at

Post
├── id
├── project_id
├── author_id
├── title
├── content
├── type (free text: discussion/review/question/...)
├── status (open/resolved/closed)
├── tags[] (free text array)
├── mentions[] (parsed @xxx)
├── pinned
├── created_at
└── updated_at

Comment
├── id
├── post_id
├── author_id
├── parent_id (nested replies)
├── content
├── mentions[]
└── created_at

Webhook
├── id
├── project_id
├── url
├── events[] (new_post/new_comment/status_change/mention)
└── active

Notification
├── id
├── agent_id
├── type
├── payload
├── read
└── created_at
"""

import uuid
import json
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


def generate_id():
    return str(uuid.uuid4())


def generate_api_key():
    return f"mb_{uuid.uuid4().hex}"


class Agent(Base):
    """Global agent identity."""
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False, unique=True)
    api_key = Column(String, nullable=False, unique=True, default=generate_api_key)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)  # For online status tracking
    
    memberships = relationship("ProjectMember", back_populates="agent")
    notifications = relationship("Notification", back_populates="agent")
    
    def is_online(self, threshold_minutes: int = 10) -> bool:
        """Check if agent was seen within threshold."""
        if not self.last_seen:
            return False
        from datetime import timedelta
        return (datetime.utcnow() - self.last_seen) < timedelta(minutes=threshold_minutes)


class Project(Base):
    """A project workspace for agent collaboration."""
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    members = relationship("ProjectMember", back_populates="project")
    posts = relationship("Post", back_populates="project")
    webhooks = relationship("Webhook", back_populates="project")


class ProjectMember(Base):
    """Agent membership in a project with role (free text)."""
    __tablename__ = "project_members"
    
    id = Column(String, primary_key=True, default=generate_id)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    role = Column(String, default="member")  # Free text: developer, reviewer, lead, security-auditor, etc.
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    agent = relationship("Agent", back_populates="memberships")
    project = relationship("Project", back_populates="members")


class Post(Base):
    """A discussion post in a project."""
    __tablename__ = "posts"
    
    id = Column(String, primary_key=True, default=generate_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    author_id = Column(String, ForeignKey("agents.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    type = Column(String, default="discussion")  # Free text: discussion, review, question, announcement, etc.
    status = Column(String, default="open")  # open, resolved, closed
    _tags = Column("tags", Text, default="[]")
    _mentions = Column("mentions", Text, default="[]")
    pinned = Column(Boolean, default=False)
    github_ref = Column(String, nullable=True, index=True)  # GitHub PR/Issue URL for deduplication
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="posts")
    author = relationship("Agent")
    comments = relationship("Comment", back_populates="post")
    
    @property
    def tags(self):
        return json.loads(self._tags) if self._tags else []
    
    @tags.setter
    def tags(self, value):
        self._tags = json.dumps(value)
    
    @property
    def mentions(self):
        return json.loads(self._mentions) if self._mentions else []
    
    @mentions.setter
    def mentions(self, value):
        self._mentions = json.dumps(value)


class Comment(Base):
    """A comment on a post with nested reply support."""
    __tablename__ = "comments"
    
    id = Column(String, primary_key=True, default=generate_id)
    post_id = Column(String, ForeignKey("posts.id"), nullable=False)
    author_id = Column(String, ForeignKey("agents.id"), nullable=False)
    parent_id = Column(String, ForeignKey("comments.id"), nullable=True)
    content = Column(Text, nullable=False)
    _mentions = Column("mentions", Text, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    post = relationship("Post", back_populates="comments")
    author = relationship("Agent")
    parent = relationship("Comment", remote_side=[id], backref="replies")
    
    @property
    def mentions(self):
        return json.loads(self._mentions) if self._mentions else []
    
    @mentions.setter
    def mentions(self, value):
        self._mentions = json.dumps(value)


class Webhook(Base):
    """Webhook configuration for project events."""
    __tablename__ = "webhooks"
    
    id = Column(String, primary_key=True, default=generate_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    url = Column(String, nullable=False)
    _events = Column("events", Text, default='["new_post","new_comment","status_change","mention"]')
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="webhooks")
    
    @property
    def events(self):
        return json.loads(self._events) if self._events else []
    
    @events.setter
    def events(self, value):
        self._events = json.dumps(value)


class GitHubWebhook(Base):
    """GitHub webhook configuration for a project."""
    __tablename__ = "github_webhooks"
    
    id = Column(String, primary_key=True, default=generate_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    secret = Column(String, nullable=False)  # For verifying X-Hub-Signature-256
    _events = Column("events", Text, default='["pull_request","issues","push"]')  # GitHub event types to handle
    _labels = Column("labels", Text, default='[]')  # Only handle PRs/issues with these labels (empty = all)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project")
    
    @property
    def events(self):
        return json.loads(self._events) if self._events else []
    
    @events.setter
    def events(self, value):
        self._events = json.dumps(value)
    
    @property
    def labels(self):
        return json.loads(self._labels) if self._labels else []
    
    @labels.setter
    def labels(self, value):
        self._labels = json.dumps(value)


class Notification(Base):
    """Notification for agent polling."""
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=generate_id)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    type = Column(String, nullable=False)  # mention, reply, status_change
    _payload = Column("payload", Text, default="{}")
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    agent = relationship("Agent", back_populates="notifications")
    
    @property
    def payload(self):
        return json.loads(self._payload) if self._payload else {}
    
    @payload.setter
    def payload(self, value):
        self._payload = json.dumps(value)
