"""
Claude AI service integration for the Clarity Lecture Chat feature.

This module handles communication with Anthropic's Claude API.
"""

import os
import logging
from typing import Dict, Any, Optional, List
import json
import httpx
import time
from datetime import datetime

# Setup logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class AnthropicService:
    """Service for interacting with the Anthropic Claude API"""
    
    def __init__(self):
        """Initialize the Anthropic service with API configuration"""
        # Set model first
        self.model = "claude-3-sonnet-20240229"  # Hardcode the correct model name
        self.api_url = "https://api.anthropic.com/v1/messages"
        
        # Check for API key in environment variables
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not self.api_key:
            logger.warning("ANTHROPIC_API_KEY is not set. Chat functionality will be limited.")
        else:
            logger.info(f"Anthropic service initialized with model: {self.model}")
            logger.debug("API key found with length: %d", len(self.api_key))
    
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
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            
            with httpx.Client(timeout=5.0) as client:
                response = client.get(
                    "https://api.anthropic.com/v1/models",
                    headers=headers
                )
                
            logger.info(f"Health check response status: {response.status_code}")
            if response.status_code != 200:
                logger.error(f"Health check failed with status {response.status_code}: {response.text}")
                return False
            return True
        except Exception as e:
            logger.error(f"Error checking Anthropic API health: {str(e)}")
            return False
    
    async def chat_completion(
        self, 
        message: str, 
        document_text: Optional[str] = None,
        selected_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get a completion from Claude for the user's message
        
        Args:
            message: The user's message
            document_text: Optional full document text for reference
            selected_text: Optional text specifically selected by the user
            
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
                system_prompt += f"\n\n{selected_text}"
            
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
            
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
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