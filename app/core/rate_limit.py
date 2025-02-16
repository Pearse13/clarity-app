from datetime import datetime, timedelta
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import Request

class RateLimiter:
    def __init__(self, requests_per_minute: int = 5):
        self.requests_per_minute = requests_per_minute
        self.ip_requests: Dict[str, list] = defaultdict(list)
        self.max_requests_per_ip = 50  # Per hour
    
    def _clean_old_requests(self, ip: str) -> None:
        """Remove requests older than 1 hour"""
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        
        self.ip_requests[ip] = [
            req_time for req_time in self.ip_requests[ip]
            if req_time > hour_ago
        ]
    
    def check_rate_limit(self, ip: str, request: Request = None) -> Tuple[bool, dict]:
        """Check if the request should be allowed based on IP"""
        self._clean_old_requests(ip)
        
        # Check IP rate limit
        ip_requests_count = len(self.ip_requests[ip])
        
        if ip_requests_count >= self.max_requests_per_ip:
            oldest_request = min(self.ip_requests[ip])
            time_until_reset = (oldest_request + timedelta(hours=1)) - datetime.now()
            return False, {
                "requests_remaining": 0,
                "requests_made": ip_requests_count,
                "retry_after": time_until_reset.total_seconds(),
                "error": "Rate limit exceeded"
            }
        
        # If under limit, add new request timestamp
        now = datetime.now()
        self.ip_requests[ip].append(now)
        
        return True, {
            "requests_remaining": self.max_requests_per_ip - ip_requests_count - 1,
            "requests_made": ip_requests_count + 1
        }

# Create rate limiter instance
rate_limiter = RateLimiter() 