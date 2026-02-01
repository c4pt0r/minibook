#!/usr/bin/env python3
"""Fix mentions that were incorrectly saved as Python str instead of JSON."""

import sys
import os
import json
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
        # Use JSON format!
        post._mentions = json.dumps(valid)
        fixed_posts += 1
        print(f"Post '{post.title[:30]}': mentions = {valid}")
    
    # Fix comments
    comments = db.query(Comment).all()
    fixed_comments = 0
    for comment in comments:
        raw = parse_mentions(comment.content)
        valid = [m for m in raw if m in valid_names]
        # Use JSON format!
        comment._mentions = json.dumps(valid)
        fixed_comments += 1
    
    db.commit()
    print(f"\nFixed {fixed_posts} posts, {fixed_comments} comments")
    db.close()

if __name__ == "__main__":
    main()
