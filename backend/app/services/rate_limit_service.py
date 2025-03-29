from datetime import datetime, timedelta
from typing import Dict, Optional, Union, Any
import logging
import os
import json
import redis
from redis.client import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)

# Cost per token in GBP (£)
COST_PER_1K_INPUT_TOKENS = 0.0025  # £0.0025 per 1K input tokens for Claude 3 Sonnet
COST_PER_1K_OUTPUT_TOKENS = 0.0075  # £0.0075 per 1K output tokens for Claude 3 Sonnet
HOURLY_COST_LIMIT = 0.80  # £0.80 per hour

class RateLimitService:
    def __init__(self):
        # Initialize Redis connection
        redis_url = os.getenv('REDIS_URL')
        self._redis: Optional[Redis] = None
        self._use_redis = False
        self._usage_data: Dict[str, Dict[str, Any]] = {}

        if not redis_url:
            logger.warning("REDIS_URL not set. Using in-memory storage (not recommended for production).")
        else:
            try:
                self._redis = redis.from_url(redis_url)
                self._use_redis = True
                logger.info("Successfully connected to Redis")
            except RedisError as e:
                logger.error(f"Failed to connect to Redis: {e}")
    
    def _get_redis_key(self, user_id: str) -> str:
        """Generate Redis key for user data"""
        return f"rate_limit:{user_id}"
    
    def _get_user_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user data from storage"""
        if self._use_redis and self._redis is not None:
            try:
                data = self._redis.get(self._get_redis_key(user_id))
                if isinstance(data, bytes):
                    return json.loads(data.decode('utf-8'))
                return None
            except RedisError as e:
                logger.error(f"Redis error getting user data: {e}")
                return None
        else:
            return self._usage_data.get(user_id)
    
    def _set_user_data(self, user_id: str, data: Dict[str, Any]) -> None:
        """Set user data in storage"""
        if self._use_redis and self._redis is not None:
            try:
                # Convert datetime to string for JSON serialization
                data_copy = data.copy()
                if isinstance(data_copy.get("reset_time"), datetime):
                    data_copy["reset_time"] = data_copy["reset_time"].isoformat()
                
                # Set with 2-hour expiry (longer than the rate limit window)
                self._redis.setex(
                    self._get_redis_key(user_id),
                    7200,  # 2 hours in seconds
                    json.dumps(data_copy)
                )
            except RedisError as e:
                logger.error(f"Redis error setting user data: {e}")
        else:
            self._usage_data[user_id] = data
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost in GBP for the given token usage"""
        input_cost = (input_tokens / 1000) * COST_PER_1K_INPUT_TOKENS
        output_cost = (output_tokens / 1000) * COST_PER_1K_OUTPUT_TOKENS
        return input_cost + output_cost
    
    def check_rate_limit(self, user_id: str, input_tokens: int, output_tokens: Optional[int] = None) -> tuple[bool, float, float]:
        """
        Check if the user has exceeded their rate limit
        Returns: (allowed: bool, current_cost: float, remaining_budget: float)
        """
        now = datetime.now()
        user_data = self._get_user_data(user_id)
        
        # Initialize or reset if hour has passed
        if not user_data:
            user_data = {
                "reset_time": now + timedelta(hours=1),
                "cost": 0.0
            }
        else:
            # Convert reset_time back to datetime if it's a string
            if isinstance(user_data["reset_time"], str):
                user_data["reset_time"] = datetime.fromisoformat(user_data["reset_time"])
            
            # Reset if time has passed
            if now >= user_data["reset_time"]:
                user_data = {
                    "reset_time": now + timedelta(hours=1),
                    "cost": 0.0
                }
        
        # Calculate potential cost
        potential_cost = self._calculate_cost(input_tokens, output_tokens or 0)
        current_cost = user_data["cost"]
        new_total_cost = current_cost + potential_cost
        
        # Check if this would exceed the limit
        is_allowed = new_total_cost <= HOURLY_COST_LIMIT
        remaining_budget = HOURLY_COST_LIMIT - current_cost
        
        if is_allowed:
            # Only update the cost if we're checking both input and output tokens
            if output_tokens is not None:
                user_data["cost"] = new_total_cost
                self._set_user_data(user_id, user_data)
        
        return is_allowed, current_cost, remaining_budget
    
    def update_usage(self, user_id: str, input_tokens: int, output_tokens: int):
        """Update the usage after a successful API call"""
        user_data = self._get_user_data(user_id)
        if user_data:
            # Convert reset_time back to datetime if it's a string
            if isinstance(user_data["reset_time"], str):
                user_data["reset_time"] = datetime.fromisoformat(user_data["reset_time"])
                
            cost = self._calculate_cost(input_tokens, output_tokens)
            user_data["cost"] += cost
            self._set_user_data(user_id, user_data)
            logger.info(f"Updated usage for user {user_id}: +£{cost:.4f} (Total: £{user_data['cost']:.4f})")
    
    def get_usage_info(self, user_id: str) -> Dict:
        """Get current usage information for a user"""
        user_data = self._get_user_data(user_id)
        if not user_data:
            return {
                "current_cost": 0.0,
                "remaining_budget": HOURLY_COST_LIMIT,
                "reset_time": (datetime.now() + timedelta(hours=1)).isoformat()
            }
        
        # Convert reset_time back to datetime if it's a string
        if isinstance(user_data["reset_time"], str):
            reset_time = user_data["reset_time"]
        else:
            reset_time = user_data["reset_time"].isoformat()
        
        return {
            "current_cost": user_data["cost"],
            "remaining_budget": HOURLY_COST_LIMIT - user_data["cost"],
            "reset_time": reset_time
        }

# Global instance
rate_limiter = RateLimitService() 