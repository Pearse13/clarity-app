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
from ..services.token_tracking_service import token_tracker
from ..dependencies.services import get_anthropic_service

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create router
router = APIRouter(
    prefix="/chat",
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
    context_before: Optional[str] = Field(None, description="Text context before the selection")
    context_after: Optional[str] = Field(None, description="Text context after the selection")

class TokenUsage(BaseModel):
    """Schema for token usage information"""
    input_tokens: int = Field(0, description="Number of tokens in the prompt")
    output_tokens: int = Field(0, description="Number of tokens in the completion")
    total_tokens: int = Field(0, description="Total tokens used")

class RemainingTokens(BaseModel):
    """Schema for remaining tokens information"""
    input: int = Field(..., description="Remaining input tokens")
    output: int = Field(..., description="Remaining output tokens")
    
class ChatResponse(BaseModel):
    """Schema for chat response from the API"""
    message: str = Field(..., description="Response from the assistant")
    model: str = Field(..., description="Model used for the response")
    token_usage: TokenUsage = Field(..., description="Token usage information")
    remaining_tokens: RemainingTokens = Field(..., description="Remaining tokens information")

def generate_document_id(document_text: Optional[str]) -> str:
    """Generate a consistent ID for a document."""
    if not document_text:
        return "no_document"
    return hashlib.md5(document_text.encode()).hexdigest()

@router.get("/health")
def health_check():
    """Check if the chat service is operational"""
    is_healthy = anthropic_service.health_check()
    if not is_healthy:
        return {"status": "unhealthy", "message": "Anthropic API not configured or unavailable"}
    return {"status": "healthy", "message": "Chat service is operational"}

@router.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage, anthropic_service: AnthropicService = Depends(get_anthropic_service)) -> ChatResponse:
    """
    Chat endpoint that forwards messages to Claude and returns responses
    """
    try:
        # Generate document ID
        document_id = generate_document_id(message.document_text)
        
        # Get current remaining tokens
        remaining = token_tracker.get_remaining_tokens(document_id)
        
        response = await anthropic_service.chat_completion(
            message=message.message,
            document_text=message.document_text,
            selected_text=message.selected_text,
            context_before=message.context_before,
            context_after=message.context_after
        )
        
        # Update token usage
        token_usage = response["usage"]
        remaining = token_tracker.update_token_usage(
            document_id,
            token_usage["input_tokens"],
            token_usage["output_tokens"]
        )
        
        return ChatResponse(
            message=response["message"],
            model=response["model"],
            token_usage=TokenUsage(
                input_tokens=token_usage["input_tokens"],
                output_tokens=token_usage["output_tokens"],
                total_tokens=token_usage["total_tokens"]
            ),
            remaining_tokens=RemainingTokens(
                input=remaining["input"],
                output=remaining["output"]
            )
        )
    except Exception as e:
        logger.error(f"Error in chat completion: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process chat: {str(e)}"
        ) 