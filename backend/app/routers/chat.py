"""
Chat Router for Clarity Lecture Chat Feature
"""

import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from pydantic import BaseModel, Field
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import sys
import json
import time
from datetime import datetime, timedelta
import traceback

# Mock User class for development - will be replaced with proper auth
class User:
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email

# Mock auth function for development
def get_current_user():
    return User(id="dev-user", email="dev@example.com")

# Import the anthropic service
from ..services.anthropic_service import AnthropicService

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

class ChatMessage(BaseModel):
    """Schema for chat message exchange"""
    message: str = Field(..., description="The user's message")
    document_text: Optional[str] = Field(None, description="The document text to reference")
    selected_text: Optional[str] = Field(None, description="Text specifically selected by the user")

class TokenUsage(BaseModel):
    """Schema for token usage information"""
    prompt_tokens: int = Field(0, description="Number of tokens in the prompt")
    completion_tokens: int = Field(0, description="Number of tokens in the completion")
    total_tokens: int = Field(0, description="Total tokens used")
    
class ChatResponse(BaseModel):
    """Schema for chat response from the API"""
    message: str = Field(..., description="Response from the assistant")
    model: str = Field(..., description="Model used for the response")
    token_usage: TokenUsage = Field(..., description="Token usage information")

@router.get("/health")
def health_check():
    """Check if the chat service is operational"""
    is_healthy = anthropic_service.health_check()
    if not is_healthy:
        return {"status": "unhealthy", "message": "Anthropic API not configured or unavailable"}
    return {"status": "healthy", "message": "Chat service is operational"}

@router.post("", response_model=ChatResponse)
async def chat(chat_request: ChatMessage, current_user: User = Depends(get_current_user)):
    """
    Process a chat request and return a response from Claude
    
    Args:
        chat_request: The user's message and document context
        current_user: The authenticated user
        
    Returns:
        ChatResponse: The assistant's response and metadata
    """
    # Get chat completion from Anthropic service
    completion_result = await anthropic_service.chat_completion(
        message=chat_request.message,
        document_text=chat_request.document_text,
        selected_text=chat_request.selected_text
    )
    
    if not completion_result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=completion_result.get("message", "Failed to get response from AI service")
        )
    
    # Return the response
    return ChatResponse(
        message=completion_result.get("message", ""),
        model=completion_result.get("model", "unknown"),
        token_usage=TokenUsage(
            prompt_tokens=completion_result.get("usage", {}).get("input_tokens", 0),
            completion_tokens=completion_result.get("usage", {}).get("output_tokens", 0),
            total_tokens=completion_result.get("usage", {}).get("total_tokens", 0)
        )
    ) 