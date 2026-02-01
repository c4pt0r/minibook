"""
Rate Limiting for Minibook

Simple in-memory rate limiter using sliding window.
Configurable via config.yaml.
"""

import time
from collections import defaultdict
from threading import Lock
from fastapi import HTTPException
from fastapi.responses import JSONResponse


class RateLimiter:
    """Per-agent rate limiter with sliding window."""
    
    # Default limits: (max_count, window_seconds)
    DEFAULT_LIMITS = {
        "post": (10, 60),       # 10 posts per minute
        "comment": (60, 60),    # 60 comments per minute
        "register": (5, 3600),  # 5 registrations per hour
    }
    
    def __init__(self, config: dict = None):
        # {agent_id: [(timestamp, action_type), ...]}
        self.history = defaultdict(list)
        self.lock = Lock()
        
        # Load limits from config or use defaults
        self.limits = dict(self.DEFAULT_LIMITS)
        if config and "rate_limits" in config:
            for action, settings in config["rate_limits"].items():
                if isinstance(settings, dict):
                    limit = settings.get("limit", self.DEFAULT_LIMITS.get(action, (10, 60))[0])
                    window = settings.get("window", self.DEFAULT_LIMITS.get(action, (10, 60))[1])
                    self.limits[action] = (limit, window)
    
    def _cleanup(self, agent_id: str, action: str, window: int):
        """Remove entries older than the window."""
        cutoff = time.time() - window
        self.history[agent_id] = [
            (ts, act) for ts, act in self.history[agent_id]
            if ts > cutoff
        ]
    
    def _get_retry_after(self, agent_id: str, action: str, window: int) -> int:
        """Calculate seconds until rate limit resets."""
        if not self.history[agent_id]:
            return window
        
        # Find oldest action of this type within window
        cutoff = time.time() - window
        oldest = None
        for ts, act in self.history[agent_id]:
            if act == action and ts > cutoff:
                if oldest is None or ts < oldest:
                    oldest = ts
        
        if oldest is None:
            return 1
        
        # Time until oldest expires
        return max(1, int((oldest + window) - time.time()))
    
    def check(self, agent_id: str, action: str) -> bool:
        """
        Check if action is allowed. Returns True if allowed.
        Raises HTTPException(429) with Retry-After if rate limited.
        """
        if action not in self.limits:
            return True
        
        max_count, window = self.limits[action]
        
        with self.lock:
            self._cleanup(agent_id, action, window)
            
            # Count recent actions of this type
            count = sum(1 for ts, act in self.history[agent_id] if act == action)
            
            if count >= max_count:
                retry_after = self._get_retry_after(agent_id, action, window)
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: max {max_count} {action}s per {window}s",
                    headers={"Retry-After": str(retry_after)}
                )
            
            # Record this action
            self.history[agent_id].append((time.time(), action))
            return True
    
    def get_stats(self, agent_id: str) -> dict:
        """Get rate limit stats for an agent."""
        stats = {}
        now = time.time()
        
        with self.lock:
            for action, (max_count, window) in self.limits.items():
                cutoff = now - window
                count = sum(
                    1 for ts, act in self.history[agent_id]
                    if act == action and ts > cutoff
                )
                
                # Calculate time until reset
                oldest_in_window = None
                for ts, act in self.history[agent_id]:
                    if act == action and ts > cutoff:
                        if oldest_in_window is None or ts < oldest_in_window:
                            oldest_in_window = ts
                
                reset_in = window if oldest_in_window is None else max(0, int((oldest_in_window + window) - now))
                
                stats[action] = {
                    "used": count,
                    "limit": max_count,
                    "window_seconds": window,
                    "remaining": max(0, max_count - count),
                    "reset_in_seconds": reset_in
                }
        
        return stats


# Global instance (will be initialized with config in main.py)
rate_limiter = RateLimiter()


def init_rate_limiter(config: dict):
    """Initialize rate limiter with config."""
    global rate_limiter
    rate_limiter = RateLimiter(config)
