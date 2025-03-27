"""
Claude AI service integration for the Clarity Lecture Chat feature.

This module handles communication with Anthropic's Claude API.
"""

import os
import logging
from typing import Dict, Any, Optional
import json
import httpx
import time
from datetime import datetime
from fastapi import HTTPException

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class TokenLimitExceededError(Exception):
    """Raised when token usage exceeds the limit for a document"""
    pass

class AnthropicService:
    """Service for interacting with the Anthropic Claude API"""
    
    def __init__(self):
        """Initialize the Anthropic service with API configuration"""
        # Set model first
        self.model = "claude-3-5-sonnet-20240620"  # Using the specified model from roadmap
        self.api_url = "https://api.anthropic.com/v1/messages"
        self.api_version = "2023-06-01"  # Using the stable API version
        
        # Token limits based on £0.40 budget with 80/20 split
        self.MAX_INPUT_TOKENS = 133333  # £0.32 worth of input tokens
        self.MAX_OUTPUT_TOKENS = 6666   # £0.08 worth of output tokens
        
        # Token usage tracking per document
        self.document_token_usage = {}
        
        # Check for API key in environment variables
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not self.api_key:
            logger.warning("ANTHROPIC_API_KEY is not set. Chat functionality will be limited.")
        else:
            logger.info(f"Anthropic service initialized with model: {self.model}")
            logger.debug("API key found with length: %d", len(self.api_key))
    
    def _check_token_limit(self, document_id: str, input_tokens: int, output_tokens: int) -> None:
        """
        Check if the token usage for a document would exceed limits
        
        Args:
            document_id: Unique identifier for the document
            input_tokens: Number of input tokens for this request
            output_tokens: Number of output tokens for this request
            
        Raises:
            TokenLimitExceededError: If the token limit would be exceeded
        """
        if document_id not in self.document_token_usage:
            self.document_token_usage[document_id] = {
                "input_tokens": 0,
                "output_tokens": 0
            }
        
        usage = self.document_token_usage[document_id]
        new_input_total = usage["input_tokens"] + input_tokens
        new_output_total = usage["output_tokens"] + output_tokens
        
        if new_input_total > self.MAX_INPUT_TOKENS:
            raise TokenLimitExceededError(
                f"Input token limit exceeded. Used: {usage['input_tokens']}, "
                f"Requested: {input_tokens}, Limit: {self.MAX_INPUT_TOKENS}"
            )
        
        if new_output_total > self.MAX_OUTPUT_TOKENS:
            raise TokenLimitExceededError(
                f"Output token limit exceeded. Used: {usage['output_tokens']}, "
                f"Requested: {output_tokens}, Limit: {self.MAX_OUTPUT_TOKENS}"
            )
    
    def _update_token_usage(self, document_id: str, input_tokens: int, output_tokens: int) -> None:
        """Update token usage tracking for a document"""
        if document_id not in self.document_token_usage:
            self.document_token_usage[document_id] = {
                "input_tokens": 0,
                "output_tokens": 0
            }
        
        self.document_token_usage[document_id]["input_tokens"] += input_tokens
        self.document_token_usage[document_id]["output_tokens"] += output_tokens
        
        logger.info(f"Updated token usage for document {document_id}: "
                   f"Input: {self.document_token_usage[document_id]['input_tokens']}, "
                   f"Output: {self.document_token_usage[document_id]['output_tokens']}")
    
    def health_check(self) -> bool:
        """
        Check if the Anthropic API is properly configured and accessible
        
        Returns:
            bool: True if the service is operational, False otherwise
        """
        if not self.api_key:
            logger.error("No API key found")
            return False
            
        try:
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": self.api_version,
                "content-type": "application/json"
            }
            
            logger.info(f"Attempting health check with API version: {self.api_version}")
            logger.debug(f"Request headers: {headers}")
            
            with httpx.Client(timeout=5.0) as client:
                response = client.get(
                    "https://api.anthropic.com/v1/models",
                    headers=headers
                )
                
            logger.info(f"Health check response status: {response.status_code}")
            
            try:
                response_data = response.json()
                logger.info(f"Health check response data: {json.dumps(response_data, indent=2)}")
            except json.JSONDecodeError:
                logger.error(f"Failed to parse response as JSON. Raw response: {response.text}")
            
            if response.status_code != 200:
                logger.error(f"Health check failed with status {response.status_code}")
                logger.error(f"Response headers: {dict(response.headers)}")
                logger.error(f"Response body: {response.text}")
                return False
                
            return True
        except Exception as e:
            logger.error(f"Error checking Anthropic API health: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error details: {str(e)}")
            return False
    
    async def chat_completion(
        self, 
        message: str, 
        document_text: Optional[str] = None,
        selected_text: Optional[str] = None,
        context_before: Optional[str] = None,
        context_after: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get a completion from Claude for the user's message
        
        Args:
            message: The user's message
            document_text: Optional full document text for reference
            selected_text: Optional text specifically selected by the user
            context_before: Optional text context before the selection
            context_after: Optional text context after the selection
            document_id: Optional unique identifier for the document (for token tracking)
            
        Returns:
            Dict containing:
                - success: Boolean indicating if the request was successful
                - message: The response from Claude or an error message
                - model: The model used for the response
                - usage: Token usage information
        """
        # Return fallback response if API key is not set
        if not self.api_key:
            return {
                "success": True,
                "message": "API key not configured. This is a fallback response.",
                "model": "fallback",
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
            }
        
        try:
            # Build the system prompt with context
            system_prompt = "You are a helpful AI teaching assistant that helps students understand lecture material."
            
            if document_text:
                system_prompt += "\n\nYou have access to the following lecture document:"
                system_prompt += f"\n\n{document_text[:8000]}"  # Limit to 8000 chars to avoid token limits
            
            if selected_text:
                system_prompt += "\n\nThe user has specifically selected this text to ask about:"
                if context_before:
                    system_prompt += f"\n\nContext before the selection:\n{context_before}"
                system_prompt += f"\n\nSelected text:\n{selected_text}"
                if context_after:
                    system_prompt += f"\n\nContext after the selection:\n{context_after}"
                system_prompt += "\n\nPlease focus on explaining the selected text while using the surrounding context to provide a more accurate and complete answer."
            
            # Prepare the request payload
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": message
                    }
                ],
                "system": system_prompt,
                "max_tokens": 1000
            }
            
            # If we have a document ID, check token limits
            if document_id:
                # Estimate input tokens (rough estimate: 1 token ≈ 4 characters)
                estimated_input_tokens = (len(system_prompt) + len(message)) // 4
                estimated_output_tokens = 1000  # max_tokens from payload
                
                try:
                    self._check_token_limit(
                        document_id,
                        estimated_input_tokens,
                        estimated_output_tokens
                    )
                except TokenLimitExceededError as e:
                    return {
                        "success": False,
                        "message": str(e),
                        "model": self.model,
                        "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
                    }
            
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": self.api_version,
                "content-type": "application/json"
            }
            
            # Make the API request
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
            # Parse the response
            response_data = response.json()
            
            if response.status_code != 200:
                logger.error(f"Anthropic API error: {response_data}")
                error_message = response_data.get("error", {}).get("message", "Unknown error")
                return {
                    "success": False,
                    "message": f"API error: {error_message}",
                    "model": self.model,
                    "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
                }
            
            # Extract the response message and usage information
            content = response_data.get("content", [{"text": "No response received"}])[0].get("text", "No response received")
            usage = response_data.get("usage", {})
            
            # Update token usage if we have a document ID
            if document_id:
                self._update_token_usage(
                    document_id,
                    usage.get("input_tokens", 0),
                    usage.get("completion_tokens", 0)
                )
            
            return {
                "success": True,
                "message": content,
                "model": response_data.get("model", self.model),
                "usage": {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in chat completion: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "model": self.model,
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
            }

# Create a singleton instance
anthropic_service = AnthropicService() 