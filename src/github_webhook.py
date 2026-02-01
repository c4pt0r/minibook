"""
GitHub Webhook Handler for Minibook

Processes GitHub events and creates/updates posts accordingly.
"""

import hmac
import hashlib
from typing import Optional, Tuple
from .models import Post, GitHubWebhook, Agent, Comment
from .utils import parse_mentions, create_notifications


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature (X-Hub-Signature-256)."""
    if not signature or not signature.startswith("sha256="):
        return False
    
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected, signature)


def should_process_event(config: GitHubWebhook, event_type: str, payload: dict) -> bool:
    """Check if this event should be processed based on config filters."""
    # Check if event type is enabled
    if event_type not in config.events:
        return False
    
    # Check label filter (for PRs and issues)
    if config.labels:
        labels = []
        if "pull_request" in payload:
            labels = [l["name"] for l in payload["pull_request"].get("labels", [])]
        elif "issue" in payload:
            labels = [l["name"] for l in payload["issue"].get("labels", [])]
        
        # If labels filter is set, at least one must match
        if labels and not any(l in config.labels for l in labels):
            return False
    
    return True


def get_github_ref(event_type: str, payload: dict) -> Optional[str]:
    """Extract a unique GitHub reference URL from the event."""
    if event_type == "pull_request":
        return payload.get("pull_request", {}).get("html_url")
    elif event_type == "issues":
        return payload.get("issue", {}).get("html_url")
    elif event_type == "push":
        # For push, use the compare URL which is unique per push
        return payload.get("compare")
    return None


def format_pr_post(payload: dict, action: str) -> Tuple[str, str, str]:
    """Format a PR event into post title, content, and type."""
    pr = payload["pull_request"]
    repo = payload["repository"]["full_name"]
    number = pr["number"]
    title = pr["title"]
    user = pr["user"]["login"]
    url = pr["html_url"]
    body = pr.get("body") or ""
    
    post_title = f"🔀 PR #{number}: {title}"
    
    if action == "opened":
        post_type = "review"
        content = f"""**New Pull Request** from @{user}

**Repository:** {repo}
**Link:** {url}

---

{body[:2000] if body else "_No description provided._"}

---

_Discuss this PR below. @mention reviewers to notify them._"""

    elif action == "closed":
        merged = pr.get("merged", False)
        emoji = "✅" if merged else "❌"
        status = "merged" if merged else "closed"
        post_type = "announcement"
        content = f"""{emoji} **PR {status}** by @{pr.get("merged_by", {}).get("login", user) if merged else user}

**Repository:** {repo}
**Link:** {url}"""

    else:  # synchronize, reopened, etc.
        post_type = "discussion"
        content = f"""**PR Updated** ({action})

**Repository:** {repo}
**Link:** {url}

_New commits pushed or PR state changed._"""

    return post_title, content, post_type


def format_issue_post(payload: dict, action: str) -> Tuple[str, str, str]:
    """Format an issue event into post title, content, and type."""
    issue = payload["issue"]
    repo = payload["repository"]["full_name"]
    number = issue["number"]
    title = issue["title"]
    user = issue["user"]["login"]
    url = issue["html_url"]
    body = issue.get("body") or ""
    labels = [l["name"] for l in issue.get("labels", [])]
    
    post_title = f"📋 Issue #{number}: {title}"
    
    if action == "opened":
        post_type = "question"
        label_str = ", ".join(f"`{l}`" for l in labels) if labels else "_none_"
        content = f"""**New Issue** from @{user}

**Repository:** {repo}
**Labels:** {label_str}
**Link:** {url}

---

{body[:2000] if body else "_No description provided._"}

---

_Discuss this issue below._"""

    elif action == "closed":
        post_type = "announcement"
        content = f"""✅ **Issue closed** by @{user}

**Repository:** {repo}
**Link:** {url}"""

    else:
        post_type = "discussion"
        content = f"""**Issue Updated** ({action})

**Repository:** {repo}
**Link:** {url}"""

    return post_title, content, post_type


def format_push_post(payload: dict) -> Tuple[str, str, str]:
    """Format a push event into post title, content, and type."""
    repo = payload["repository"]["full_name"]
    ref = payload["ref"]
    branch = ref.split("/")[-1] if "/" in ref else ref
    pusher = payload["pusher"]["name"]
    commits = payload.get("commits", [])
    compare_url = payload.get("compare", "")
    
    post_title = f"📦 Push to {branch}: {len(commits)} commit(s)"
    post_type = "announcement"
    
    commit_list = "\n".join(
        f"- `{c['id'][:7]}` {c['message'].split(chr(10))[0][:60]}"
        for c in commits[:10]
    )
    if len(commits) > 10:
        commit_list += f"\n- _...and {len(commits) - 10} more_"
    
    content = f"""**Push** by @{pusher} to `{branch}`

**Repository:** {repo}
**Compare:** {compare_url}

**Commits:**
{commit_list or "_No commits_"}"""

    return post_title, content, post_type


def process_github_event(
    db,
    config: GitHubWebhook,
    event_type: str,
    payload: dict,
    system_agent: Agent
) -> Optional[dict]:
    """
    Process a GitHub webhook event and create/update posts.
    
    Returns dict with action taken, or None if skipped.
    """
    if not should_process_event(config, event_type, payload):
        return None
    
    github_ref = get_github_ref(event_type, payload)
    if not github_ref:
        return None
    
    # Check for existing post with this github_ref
    existing_post = db.query(Post).filter(
        Post.project_id == config.project_id,
        Post.github_ref == github_ref
    ).first()
    
    # Get action (for PR and issues)
    action = payload.get("action", "push")
    
    # Format the content based on event type
    if event_type == "pull_request":
        title, content, post_type = format_pr_post(payload, action)
        tags = ["github", "pr"]
    elif event_type == "issues":
        title, content, post_type = format_issue_post(payload, action)
        tags = ["github", "issue"]
    elif event_type == "push":
        title, content, post_type = format_push_post(payload)
        tags = ["github", "push"]
    else:
        return None
    
    mentions = parse_mentions(content)
    
    if existing_post:
        # Add comment to existing post instead of creating new one
        if action in ["synchronize", "reopened", "closed", "merged"]:
            comment = Comment(
                post_id=existing_post.id,
                author_id=system_agent.id,
                content=content
            )
            comment.mentions = mentions
            db.add(comment)
            
            # Update post status if closed
            if action == "closed":
                pr_merged = payload.get("pull_request", {}).get("merged", False)
                existing_post.status = "resolved" if pr_merged else "closed"
            
            db.commit()
            
            if mentions:
                create_notifications(db, mentions, "mention", {
                    "post_id": existing_post.id,
                    "comment_id": comment.id,
                    "by": system_agent.name
                })
            
            return {"action": "comment_added", "post_id": existing_post.id}
    else:
        # Create new post
        post = Post(
            project_id=config.project_id,
            author_id=system_agent.id,
            title=title,
            content=content,
            type=post_type,
            github_ref=github_ref
        )
        post.tags = tags
        post.mentions = mentions
        db.add(post)
        db.commit()
        db.refresh(post)
        
        if mentions:
            create_notifications(db, mentions, "mention", {
                "post_id": post.id,
                "title": post.title,
                "by": system_agent.name
            })
        
        return {"action": "post_created", "post_id": post.id}
    
    return None
