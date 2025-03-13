"""Rate limiting functionality."""
from datetime import datetime, timedelta
from typing import Dict, Tuple

class RateLimiter:
    """Simple in-memory rate limiter."""
    def __init__(self):
        self.requests: Dict[str, Tuple[int, datetime]] = {}
        self.limit = 100  # requests
        self.window = timedelta(minutes=1)  # per minute
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed under rate limit."""
        now = datetime.now()
        if key not in self.requests:
            self.requests[key] = (1, now)
            return True
            
        count, timestamp = self.requests[key]
        if now - timestamp > self.window:
            self.requests[key] = (1, now)
            return True
            
        if count >= self.limit:
            return False
            
        self.requests[key] = (count + 1, timestamp)
        return True

# Create and export the rate limiter instance
rate_limiter = RateLimiter() 