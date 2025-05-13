"""
Chat Router for Clarity Lecture Chat Feature
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import os
import sys
import json
import time
from datetime import datetime, timedelta
import traceback
import hashlib

# Import rate limiter
from ..services.rate_limit_service import rate_limiter

# Mock User class for development - will be replaced with proper auth
class User:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email

# Mock auth function for development
def get_current_user():
    return User(id="dev-user", email="dev@example.com")

# Import the anthropic service
from ..services.anthropic_service import AnthropicService, TokenLimitExceededError
from ..dependencies.services import get_anthropic_service

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create router
router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)

# Initialize the Anthropic service
anthropic_service = AnthropicService()

class TokenUsage(BaseModel):
    """Schema for token usage information"""
    prompt_tokens: int = Field(0, description="Number of tokens in the prompt")
    completion_tokens: int = Field(0, description="Number of tokens in the completion")
    total_tokens: int = Field(0, description="Total tokens used")

class ChatMessage(BaseModel):
    """Schema for chat message exchange"""
    message: str = Field(..., description="The user's message")
    document_text: Optional[str] = Field(None, description="The document text to reference")
    selected_text: Optional[str] = Field(None, description="Text specifically selected by the user")
    context_before: Optional[str] = Field(None, description="Text context before the selection")
    context_after: Optional[str] = Field(None, description="Text context after the selection")
    
class ChatResponse(BaseModel):
    """Schema for chat response from the API"""
    message: str = Field(..., description="Response from the assistant")
    model: str = Field(..., description="Model used for the response")
    token_usage: TokenUsage = Field(..., description="Token usage information")
    cost_info: Dict[str, Any] = Field(..., description="Cost and usage information")

def generate_document_id(document_text: Optional[str]) -> Optional[str]:
    """Generate a unique ID for a document based on its content"""
    if not document_text:
        return None
    return hashlib.sha256(document_text.encode()).hexdigest()[:16]

@router.get("/health")
def health_check():
    """Check if the chat service is operational"""
    is_healthy = anthropic_service.health_check()
    if not is_healthy:
        return {"status": "unhealthy", "message": "Anthropic API not configured or unavailable"}
    return {"status": "healthy", "message": "Chat service is operational"}

@router.get("/usage/{user_id}")
async def get_usage(user_id: str):
    """Get current usage information for a user"""
    return rate_limiter.get_usage_info(user_id)

@router.post("", response_model=ChatResponse)
async def chat(message: ChatMessage, anthropic_service: AnthropicService = Depends(get_anthropic_service)) -> ChatResponse:
    """
    Chat endpoint that forwards messages to Claude and returns responses
    """
    try:
        # Get user ID (using mock for now)
        user = get_current_user()
        
        # Estimate input tokens (rough estimate: 1 token ≈ 4 characters)
        estimated_input_tokens = (
            len(message.message) +
            len(message.document_text or "") +
            len(message.selected_text or "") +
            len(message.context_before or "") +
            len(message.context_after or "")
        ) // 4
        
        # Check rate limit before making the API call
        is_allowed, current_cost, remaining_budget = rate_limiter.check_rate_limit(
            user.id,
            estimated_input_tokens
        )
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Current cost: £{current_cost:.2f}. Hourly limit: £0.80"
            )
        
        # Generate document ID if document text is provided
        document_id = generate_document_id(message.document_text)
        
        response = await anthropic_service.chat_completion(
            message=message.message,
            document_text=message.document_text,
            selected_text=message.selected_text,
            context_before=message.context_before,
            context_after=message.context_after,
            document_id=document_id
        )
        
        if not response["success"]:
            if "token limit exceeded" in response["message"].lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=response["message"]
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=response["message"]
            )
        
        # Update rate limit with actual token usage
        rate_limiter.update_usage(
            user.id,
            response["usage"]["input_tokens"],
            response["usage"]["output_tokens"]
        )
        
        # Get updated usage info
        usage_info = rate_limiter.get_usage_info(user.id)
        
        return ChatResponse(
            message=response["message"],
            model=response["model"],
            token_usage=TokenUsage(
                prompt_tokens=response["usage"]["input_tokens"],
                completion_tokens=response["usage"]["output_tokens"],
                total_tokens=response["usage"]["total_tokens"]
            ),
            cost_info=usage_info
        )
    except TokenLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat: {str(e)}"
        ) 