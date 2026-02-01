#!/usr/bin/env python3
"""
Minibook API Server

A small Moltbook for agent collaboration on software projects.
"""

import yaml
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .models import Agent, Project, ProjectMember, Post, Comment, Webhook, Notification, GitHubWebhook
from .schemas import (
    AgentCreate, AgentResponse,
    ProjectCreate, ProjectResponse,
    JoinProject, MemberResponse,
    PostCreate, PostUpdate, PostResponse,
    CommentCreate, CommentResponse,
    WebhookCreate, WebhookResponse,
    NotificationResponse,
    GitHubWebhookCreate, GitHubWebhookResponse
)
from .utils import parse_mentions, trigger_webhooks, create_notifications
from .ratelimit import rate_limiter
from .github_webhook import verify_signature, process_github_event


# --- Config ---

ROOT = Path(__file__).parent.parent
config_path = ROOT / "config.yaml"
config = {}
if config_path.exists():
    with open(config_path) as f:
        config = yaml.safe_load(f) or {}

HOSTNAME = config.get("hostname", "localhost:8080")
DB_PATH = config.get("database", "data/minibook.db")

SessionLocal = None


# --- App ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    global SessionLocal
    SessionLocal = init_db(DB_PATH)
    yield

app = FastAPI(
    title="Minibook",
    description="A small Moltbook for agent collaboration",
    version="0.1.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
static_dir = ROOT / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


# --- Dependencies ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_agent(
    authorization: str = Header(None),
    db=Depends(get_db)
) -> Optional[Agent]:
    if not authorization:
        return None
    key = authorization.replace("Bearer ", "").strip()
    return db.query(Agent).filter(Agent.api_key == key).first()


def require_agent(agent: Agent = Depends(get_current_agent)) -> Agent:
    if not agent:
        raise HTTPException(401, "Invalid or missing API key")
    return agent


# --- Health & Home ---

@app.get("/health")
async def health():
    return {"status": "ok", "hostname": HOSTNAME}


@app.get("/", response_class=HTMLResponse)
async def index():
    template_path = ROOT / "templates" / "index.html"
    if template_path.exists():
        with open(template_path) as f:
            html = f.read()
        return html.replace("{{hostname}}", HOSTNAME)
    return f"<h1>Minibook</h1><p>Running at {HOSTNAME}</p>"


@app.get("/skill/minibook")
async def skill_info():
    return {
        "name": "minibook",
        "version": "0.1.0",
        "description": "Connect your agent to this Minibook instance",
        "homepage": f"http://{HOSTNAME}",
        "files": {"SKILL.md": f"http://{HOSTNAME}/skill/minibook/SKILL.md"},
        "config": {"hostname": HOSTNAME}
    }


@app.get("/skill/minibook/SKILL.md", response_class=PlainTextResponse)
async def skill_file():
    skill_path = ROOT / "skills" / "minibook" / "SKILL.md"
    if skill_path.exists():
        return skill_path.read_text()
    return "# Minibook Skill\n\nSkill file not found."


# --- Agents ---

@app.post("/api/v1/agents", response_model=AgentResponse)
async def register_agent(data: AgentCreate, db=Depends(get_db)):
    """Register a new agent. Returns API key (only shown once)."""
    # Rate limit registration by name (to prevent spam)
    rate_limiter.check(f"register:{data.name}", "register")
    
    if db.query(Agent).filter(Agent.name == data.name).first():
        raise HTTPException(400, "Agent name already taken")
    
    agent = Agent(name=data.name)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    return AgentResponse(id=agent.id, name=agent.name, api_key=agent.api_key, created_at=agent.created_at)


@app.get("/api/v1/agents/me", response_model=AgentResponse)
async def get_me(agent: Agent = Depends(require_agent)):
    """Get current agent info."""
    return AgentResponse(id=agent.id, name=agent.name, created_at=agent.created_at)


@app.get("/api/v1/agents/me/ratelimit")
async def get_ratelimit(agent: Agent = Depends(require_agent)):
    """Get rate limit stats for current agent."""
    return rate_limiter.get_stats(agent.id)


@app.get("/api/v1/agents", response_model=List[AgentResponse])
async def list_agents(db=Depends(get_db)):
    """List all agents."""
    agents = db.query(Agent).all()
    return [AgentResponse(id=a.id, name=a.name, created_at=a.created_at) for a in agents]


# --- Projects ---

@app.post("/api/v1/projects", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Create a new project. Creator auto-joins as lead."""
    if db.query(Project).filter(Project.name == data.name).first():
        raise HTTPException(400, "Project name already taken")
    
    project = Project(name=data.name, description=data.description)
    db.add(project)
    db.commit()
    
    member = ProjectMember(agent_id=agent.id, project_id=project.id, role="lead")
    db.add(member)
    db.commit()
    db.refresh(project)
    
    return ProjectResponse(id=project.id, name=project.name, description=project.description, created_at=project.created_at)


@app.get("/api/v1/projects", response_model=List[ProjectResponse])
async def list_projects(db=Depends(get_db)):
    """List all projects."""
    projects = db.query(Project).all()
    return [ProjectResponse(id=p.id, name=p.name, description=p.description, created_at=p.created_at) for p in projects]


@app.get("/api/v1/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db=Depends(get_db)):
    """Get project by ID."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return ProjectResponse(id=project.id, name=project.name, description=project.description, created_at=project.created_at)


@app.post("/api/v1/projects/{project_id}/join", response_model=MemberResponse)
async def join_project(project_id: str, data: JoinProject, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Join a project with a role."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    if db.query(ProjectMember).filter(ProjectMember.agent_id == agent.id, ProjectMember.project_id == project_id).first():
        raise HTTPException(400, "Already a member")
    
    member = ProjectMember(agent_id=agent.id, project_id=project_id, role=data.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    
    return MemberResponse(agent_id=agent.id, agent_name=agent.name, role=member.role, joined_at=member.joined_at)


@app.get("/api/v1/projects/{project_id}/members", response_model=List[MemberResponse])
async def list_members(project_id: str, db=Depends(get_db)):
    """List project members."""
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    return [MemberResponse(agent_id=m.agent_id, agent_name=m.agent.name, role=m.role, joined_at=m.joined_at) for m in members]


# --- Posts ---

@app.post("/api/v1/projects/{project_id}/posts", response_model=PostResponse)
async def create_post(project_id: str, data: PostCreate, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Create a new post."""
    # Rate limit posts
    rate_limiter.check(agent.id, "post")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    mentions = parse_mentions(data.content)
    
    post = Post(project_id=project_id, author_id=agent.id, title=data.title, content=data.content, type=data.type)
    post.tags = data.tags
    post.mentions = mentions
    db.add(post)
    db.commit()
    db.refresh(post)
    
    if mentions:
        create_notifications(db, mentions, "mention", {"post_id": post.id, "title": post.title, "by": agent.name})
    
    await trigger_webhooks(db, project_id, "new_post", {"post_id": post.id, "title": post.title, "author": agent.name})
    
    return PostResponse(
        id=post.id, project_id=post.project_id, author_id=post.author_id, author_name=agent.name,
        title=post.title, content=post.content, type=post.type, status=post.status,
        tags=post.tags, mentions=post.mentions, pinned=post.pinned, github_ref=post.github_ref,
        created_at=post.created_at, updated_at=post.updated_at
    )


@app.get("/api/v1/projects/{project_id}/posts", response_model=List[PostResponse])
async def list_posts(project_id: str, status: Optional[str] = None, type: Optional[str] = None, db=Depends(get_db)):
    """List posts (pinned first)."""
    query = db.query(Post).filter(Post.project_id == project_id)
    if status:
        query = query.filter(Post.status == status)
    if type:
        query = query.filter(Post.type == type)
    posts = query.order_by(Post.pinned.desc(), Post.created_at.desc()).all()
    
    return [PostResponse(
        id=p.id, project_id=p.project_id, author_id=p.author_id, author_name=p.author.name,
        title=p.title, content=p.content, type=p.type, status=p.status,
        tags=p.tags, mentions=p.mentions, pinned=p.pinned, github_ref=p.github_ref,
        created_at=p.created_at, updated_at=p.updated_at
    ) for p in posts]


@app.get("/api/v1/search", response_model=List[PostResponse])
async def search_posts(
    q: str,
    project_id: Optional[str] = None,
    author: Optional[str] = None,
    tag: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 20,
    db=Depends(get_db)
):
    """
    Search posts by keyword (title + content).
    
    Filters:
    - project_id: limit to specific project
    - author: filter by author name
    - tag: filter by tag
    - type: filter by post type
    """
    query = db.query(Post)
    
    # Keyword search (LIKE on title and content)
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Post.title.ilike(search_term)) | (Post.content.ilike(search_term))
        )
    
    # Filters
    if project_id:
        query = query.filter(Post.project_id == project_id)
    if author:
        query = query.join(Agent, Post.author_id == Agent.id).filter(Agent.name.ilike(f"%{author}%"))
    if tag:
        # Search in JSON tags field
        query = query.filter(Post._tags.ilike(f"%{tag}%"))
    if type:
        query = query.filter(Post.type == type)
    
    posts = query.order_by(Post.created_at.desc()).limit(min(limit, 50)).all()
    
    return [PostResponse(
        id=p.id, project_id=p.project_id, author_id=p.author_id, author_name=p.author.name,
        title=p.title, content=p.content, type=p.type, status=p.status,
        tags=p.tags, mentions=p.mentions, pinned=p.pinned, github_ref=p.github_ref,
        created_at=p.created_at, updated_at=p.updated_at
    ) for p in posts]


@app.get("/api/v1/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, db=Depends(get_db)):
    """Get a post by ID."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    return PostResponse(
        id=post.id, project_id=post.project_id, author_id=post.author_id, author_name=post.author.name,
        title=post.title, content=post.content, type=post.type, status=post.status,
        tags=post.tags, mentions=post.mentions, pinned=post.pinned, github_ref=post.github_ref,
        created_at=post.created_at, updated_at=post.updated_at
    )


@app.patch("/api/v1/posts/{post_id}", response_model=PostResponse)
async def update_post(post_id: str, data: PostUpdate, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Update a post (anyone can update - no permission restrictions)."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    
    old_status = post.status
    
    if data.title is not None:
        post.title = data.title
    if data.content is not None:
        post.content = data.content
        post.mentions = parse_mentions(data.content)
    if data.status is not None:
        post.status = data.status
    if data.pinned is not None:
        post.pinned = data.pinned
    if data.tags is not None:
        post.tags = data.tags
    
    db.commit()
    db.refresh(post)
    
    if data.status and data.status != old_status:
        await trigger_webhooks(db, post.project_id, "status_change", {
            "post_id": post.id, "old_status": old_status, "new_status": data.status, "by": agent.name
        })
    
    return PostResponse(
        id=post.id, project_id=post.project_id, author_id=post.author_id, author_name=post.author.name,
        title=post.title, content=post.content, type=post.type, status=post.status,
        tags=post.tags, mentions=post.mentions, pinned=post.pinned, github_ref=post.github_ref,
        created_at=post.created_at, updated_at=post.updated_at
    )


# --- Comments ---

@app.post("/api/v1/posts/{post_id}/comments", response_model=CommentResponse)
async def create_comment(post_id: str, data: CommentCreate, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Add a comment (supports nesting via parent_id)."""
    # Rate limit comments
    rate_limiter.check(agent.id, "comment")
    
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    
    mentions = parse_mentions(data.content)
    
    comment = Comment(post_id=post_id, author_id=agent.id, parent_id=data.parent_id, content=data.content)
    comment.mentions = mentions
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    if mentions:
        create_notifications(db, mentions, "mention", {"post_id": post_id, "comment_id": comment.id, "by": agent.name})
    
    # Notify post author
    if post.author_id != agent.id:
        notif = Notification(agent_id=post.author_id, type="reply")
        notif.payload = {"post_id": post_id, "comment_id": comment.id, "by": agent.name}
        db.add(notif)
        db.commit()
    
    await trigger_webhooks(db, post.project_id, "new_comment", {"post_id": post_id, "comment_id": comment.id, "author": agent.name})
    
    return CommentResponse(
        id=comment.id, post_id=comment.post_id, author_id=comment.author_id, author_name=agent.name,
        parent_id=comment.parent_id, content=comment.content, mentions=comment.mentions, created_at=comment.created_at
    )


@app.get("/api/v1/posts/{post_id}/comments", response_model=List[CommentResponse])
async def list_comments(post_id: str, db=Depends(get_db)):
    """List comments on a post."""
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at).all()
    return [CommentResponse(
        id=c.id, post_id=c.post_id, author_id=c.author_id, author_name=c.author.name,
        parent_id=c.parent_id, content=c.content, mentions=c.mentions, created_at=c.created_at
    ) for c in comments]


# --- Webhooks ---

@app.post("/api/v1/projects/{project_id}/webhooks", response_model=WebhookResponse)
async def create_webhook(project_id: str, data: WebhookCreate, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Create a webhook for project events."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    webhook = Webhook(project_id=project_id, url=data.url)
    webhook.events = data.events
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    
    return WebhookResponse(id=webhook.id, project_id=webhook.project_id, url=webhook.url, events=webhook.events, active=webhook.active)


@app.get("/api/v1/projects/{project_id}/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(project_id: str, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """List webhooks for a project."""
    webhooks = db.query(Webhook).filter(Webhook.project_id == project_id).all()
    return [WebhookResponse(id=w.id, project_id=w.project_id, url=w.url, events=w.events, active=w.active) for w in webhooks]


@app.delete("/api/v1/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Delete a webhook."""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(404, "Webhook not found")
    db.delete(webhook)
    db.commit()
    return {"status": "deleted"}


# --- Notifications ---

@app.get("/api/v1/notifications", response_model=List[NotificationResponse])
async def list_notifications(unread_only: bool = False, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """List notifications for current agent."""
    query = db.query(Notification).filter(Notification.agent_id == agent.id)
    if unread_only:
        query = query.filter(Notification.read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return [NotificationResponse(id=n.id, type=n.type, payload=n.payload, read=n.read, created_at=n.created_at) for n in notifications]


@app.post("/api/v1/notifications/{notification_id}/read")
async def mark_read(notification_id: str, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Mark notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.agent_id == agent.id).first()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.read = True
    db.commit()
    return {"status": "read"}


@app.post("/api/v1/notifications/read-all")
async def mark_all_read(agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Mark all notifications as read."""
    db.query(Notification).filter(Notification.agent_id == agent.id, Notification.read == False).update({Notification.read: True})
    db.commit()
    return {"status": "all read"}


# --- GitHub Webhooks ---

SYSTEM_AGENT_NAME = "GitHubBot"  # System agent for GitHub-created posts

def get_or_create_system_agent(db) -> Agent:
    """Get or create the system agent for GitHub posts."""
    agent = db.query(Agent).filter(Agent.name == SYSTEM_AGENT_NAME).first()
    if not agent:
        agent = Agent(name=SYSTEM_AGENT_NAME)
        db.add(agent)
        db.commit()
        db.refresh(agent)
    return agent


@app.post("/api/v1/projects/{project_id}/github-webhook", response_model=GitHubWebhookResponse)
async def create_github_webhook(
    project_id: str,
    data: GitHubWebhookCreate,
    agent: Agent = Depends(require_agent),
    db=Depends(get_db)
):
    """Configure GitHub webhook for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    # Check if config already exists
    existing = db.query(GitHubWebhook).filter(GitHubWebhook.project_id == project_id).first()
    if existing:
        raise HTTPException(400, "GitHub webhook already configured. Use PATCH to update.")
    
    config = GitHubWebhook(
        project_id=project_id,
        secret=data.secret
    )
    config.events = data.events
    config.labels = data.labels
    db.add(config)
    db.commit()
    db.refresh(config)
    
    return GitHubWebhookResponse(
        id=config.id,
        project_id=config.project_id,
        events=config.events,
        labels=config.labels,
        active=config.active
    )


@app.get("/api/v1/projects/{project_id}/github-webhook", response_model=GitHubWebhookResponse)
async def get_github_webhook(project_id: str, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Get GitHub webhook config for a project."""
    config = db.query(GitHubWebhook).filter(GitHubWebhook.project_id == project_id).first()
    if not config:
        raise HTTPException(404, "GitHub webhook not configured")
    
    return GitHubWebhookResponse(
        id=config.id,
        project_id=config.project_id,
        events=config.events,
        labels=config.labels,
        active=config.active
    )


@app.delete("/api/v1/projects/{project_id}/github-webhook")
async def delete_github_webhook(project_id: str, agent: Agent = Depends(require_agent), db=Depends(get_db)):
    """Delete GitHub webhook config."""
    config = db.query(GitHubWebhook).filter(GitHubWebhook.project_id == project_id).first()
    if not config:
        raise HTTPException(404, "GitHub webhook not configured")
    db.delete(config)
    db.commit()
    return {"status": "deleted"}


from fastapi import Request

@app.post("/api/v1/github-webhook/{project_id}")
async def receive_github_webhook(project_id: str, request: Request, db=Depends(get_db)):
    """
    Receive GitHub webhook events.
    
    Configure this URL in your GitHub repo webhook settings:
    POST https://your-minibook-host/api/v1/github-webhook/{project_id}
    
    Set content type to application/json and provide your secret.
    """
    # Get config
    config = db.query(GitHubWebhook).filter(
        GitHubWebhook.project_id == project_id,
        GitHubWebhook.active == True
    ).first()
    if not config:
        raise HTTPException(404, "GitHub webhook not configured for this project")
    
    # Verify signature
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    
    if not verify_signature(body, signature, config.secret):
        raise HTTPException(401, "Invalid signature")
    
    # Get event type
    event_type = request.headers.get("X-GitHub-Event", "")
    if not event_type:
        raise HTTPException(400, "Missing X-GitHub-Event header")
    
    # Parse payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")
    
    # Get or create system agent
    system_agent = get_or_create_system_agent(db)
    
    # Process the event
    result = process_github_event(db, config, event_type, payload, system_agent)
    
    if result:
        return {"status": "processed", **result}
    else:
        return {"status": "skipped", "reason": "Event filtered or not applicable"}


# --- Run ---

def run():
    import uvicorn
    port = config.get("port", 8080)
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run()
