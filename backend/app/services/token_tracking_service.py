from typing import Dict, Optional
from datetime import datetime, timedelta

class TokenTrackingService:
    def __init__(self):
        self.MAX_INPUT_TOKENS = 133333  # ~£0.32 worth
        self.MAX_OUTPUT_TOKENS = 6666   # ~£0.08 worth
        self._token_usage: Dict[str, Dict] = {}  # document_id -> usage data
        
    def get_remaining_tokens(self, document_id: str) -> Dict[str, int]:
        """Get remaining tokens for a document."""
        if document_id not in self._token_usage:
            return {
                "input": self.MAX_INPUT_TOKENS,
                "output": self.MAX_OUTPUT_TOKENS
            }
            
        usage = self._token_usage[document_id]
        last_reset = usage.get("last_reset", datetime.min)
        
        # Reset if it's been 24 hours
        if datetime.now() - last_reset > timedelta(hours=24):
            self._token_usage[document_id] = {
                "input_used": 0,
                "output_used": 0,
                "last_reset": datetime.now()
            }
            return {
                "input": self.MAX_INPUT_TOKENS,
                "output": self.MAX_OUTPUT_TOKENS
            }
            
        return {
            "input": max(0, self.MAX_INPUT_TOKENS - usage.get("input_used", 0)),
            "output": max(0, self.MAX_OUTPUT_TOKENS - usage.get("output_used", 0))
        }
        
    def update_token_usage(self, document_id: str, input_tokens: int, output_tokens: int) -> Dict[str, int]:
        """Update token usage for a document and return remaining tokens."""
        if document_id not in self._token_usage:
            self._token_usage[document_id] = {
                "input_used": 0,
                "output_used": 0,
                "last_reset": datetime.now()
            }
            
        usage = self._token_usage[document_id]
        usage["input_used"] = min(self.MAX_INPUT_TOKENS, usage.get("input_used", 0) + input_tokens)
        usage["output_used"] = min(self.MAX_OUTPUT_TOKENS, usage.get("output_used", 0) + output_tokens)
        
        return self.get_remaining_tokens(document_id)

# Global instance
token_tracker = TokenTrackingService() 