from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN
from .config import settings
from datetime import datetime, timedelta
from typing import Optional

class APIKeyManager:
    def __init__(self):
        self.current_key = settings.API_KEY
        self.previous_key = None
        self.key_expiry = datetime.now() + timedelta(days=30)  # Keys expire after 30 days
        self.rotation_window = timedelta(days=7)  # 7-day overlap window for key rotation

    def rotate_key(self, new_key: str):
        """Rotate to a new API key while keeping the old one valid for a grace period"""
        self.previous_key = self.current_key
        self.current_key = new_key
        self.key_expiry = datetime.now() + timedelta(days=30)

    def is_key_valid(self, key: str) -> bool:
        """Check if the provided key is either the current or previous key and not expired"""
        if key == self.current_key:
            return True
        if key == self.previous_key and datetime.now() < self.key_expiry + self.rotation_window:
            return True
        return False

    def should_rotate(self) -> bool:
        """Check if it's time to rotate the key"""
        return datetime.now() > self.key_expiry - self.rotation_window

# Global instance
key_manager = APIKeyManager()

# Remove direct API key check
async def verify_request(request: Request) -> bool:
    """Verify the request based on origin and optionally API key"""
    origin = request.headers.get("Origin", "")
    if origin in settings.cors_origins:
        return True
    raise HTTPException(status_code=403, detail="Invalid origin")
