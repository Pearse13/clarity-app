from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, Tuple

class UserTracker:
    def __init__(self):
        self.user_requests: Dict[str, Dict] = defaultdict(
            lambda: {"count": 0, "reset_time": None}
        )
        self.MAX_REQUESTS = 100
        self.RESET_HOURS = 3

    def can_make_request(self, api_key: str) -> Tuple[bool, dict]:
        now = datetime.now()
        user_data = self.user_requests[api_key]
        
        # Initialize or reset if time has passed
        if user_data["reset_time"] is None:
            user_data["reset_time"] = now + timedelta(hours=self.RESET_HOURS)
        elif now >= user_data["reset_time"]:
            user_data["count"] = 0
            user_data["reset_time"] = now + timedelta(hours=self.RESET_HOURS)
        
        # Check if user has requests remaining
        if user_data["count"] >= self.MAX_REQUESTS:
            time_until_reset = user_data["reset_time"] - now
            return False, {
                "requests_remaining": 0,
                "time_until_reset": str(time_until_reset).split(".")[0],
                "reset_time": user_data["reset_time"].strftime("%Y-%m-%d %H:%M:%S")
            }

        # Increment counter and return status
        user_data["count"] += 1
        return True, {
            "requests_remaining": self.MAX_REQUESTS - user_data["count"],
            "time_until_reset": str(user_data["reset_time"] - now).split(".")[0],
            "reset_time": user_data["reset_time"].strftime("%Y-%m-%d %H:%M:%S")
        }

    def get_usage_stats(self, api_key: str) -> dict:
        user_data = self.user_requests[api_key]
        now = datetime.now()
        
        if user_data["reset_time"] is None:
            return {
                "total_requests": 0,
                "requests_remaining": self.MAX_REQUESTS,
                "time_until_reset": "N/A",
                "reset_time": "N/A"
            }
        
        return {
            "total_requests": user_data["count"],
            "requests_remaining": self.MAX_REQUESTS - user_data["count"],
            "time_until_reset": str(user_data["reset_time"] - now).split(".")[0],
            "reset_time": user_data["reset_time"].strftime("%Y-%m-%d %H:%M:%S")
        }
