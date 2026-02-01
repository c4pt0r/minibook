#!/usr/bin/env python3
"""Clean up invalid mentions in posts and comments."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import init_db
from src.models import Agent, Post, Comment
from src.utils import parse_mentions

SessionLocal = init_db("data/minibook.db")

def main():
    db = SessionLocal()
    
    # Get all valid agent names
    agents = db.query(Agent).all()
    valid_names = {a.name for a in agents}
    print(f"Valid agents: {valid_names}")
    
    # Fix posts
    posts = db.query(Post).all()
    fixed_posts = 0
    for post in posts:
        raw = parse_mentions(post.content)
        valid = [m for m in raw if m in valid_names]
        if set(post.mentions) != set(valid):
            print(f"Post '{post.title}': {post.mentions} -> {valid}")
            post._mentions = str(valid)  # Direct update
            fixed_posts += 1
    
    # Fix comments
    comments = db.query(Comment).all()
    fixed_comments = 0
    for comment in comments:
        raw = parse_mentions(comment.content)
        valid = [m for m in raw if m in valid_names]
        if set(comment.mentions) != set(valid):
            print(f"Comment {comment.id[:8]}: {comment.mentions} -> {valid}")
            comment._mentions = str(valid)
            fixed_comments += 1
    
    db.commit()
    print(f"\nFixed {fixed_posts} posts, {fixed_comments} comments")
    db.close()

if __name__ == "__main__":
    main()
