from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional, List
from collections import defaultdict
from fastapi import Request

class RateLimiter:
    def __init__(self, max_requests_per_ip: int = 100):
        self.max_requests_per_ip = max_requests_per_ip
        self.ip_requests: Dict[str, List[datetime]] = defaultdict(list)

    def _clean_old_requests(self, ip: str) -> None:
        """Remove requests older than 1 hour"""
        now = datetime.now()
        cutoff = now - timedelta(hours=1)
        self.ip_requests[ip] = [
            req for req in self.ip_requests[ip] 
            if req > cutoff
        ]

    def check_rate_limit(self, client_id: str, request: Optional[Request] = None) -> Tuple[bool, Dict[str, int | float | str]]:
        """Check if the request should be allowed based on client ID"""
        self._clean_old_requests(client_id)
        
        # Check rate limit
        requests_count = len(self.ip_requests[client_id])
        
        if requests_count >= self.max_requests_per_ip:
            oldest_request = min(self.ip_requests[client_id])
            time_until_reset = (oldest_request + timedelta(hours=1)) - datetime.now()
            return False, {
                "requests_remaining": 0,
                "requests_made": requests_count,
                "retry_after": time_until_reset.total_seconds(),
                "error": "Rate limit exceeded"
            }
        
        # If under limit, add new request timestamp
        now = datetime.now()
        self.ip_requests[client_id].append(now)
        
        return True, {
            "requests_remaining": self.max_requests_per_ip - requests_count - 1,
            "requests_made": requests_count + 1
        }

# Create rate limiter instance
rate_limiter = RateLimiter() 