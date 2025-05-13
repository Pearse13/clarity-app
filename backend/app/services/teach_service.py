import os
import logging
from typing import Dict, Any, Optional, List
from fastapi import HTTPException
from anthropic import AsyncAnthropic
from anthropic.types import MessageParam, Message, ContentBlock

logger = logging.getLogger(__name__)

class TeachService:
    """Service for handling teaching interactions using Claude"""
    
    def __init__(self):
        self.client = AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.model = "claude-3-sonnet-20240229"
        self._token_usage_cache = {}

    def health_check(self) -> bool:
        """Check if the service is operational"""
        return bool(os.getenv("ANTHROPIC_API_KEY"))

    async def continue_session(
        self,
        message: str,
        document_text: Optional[str] = None,
        selected_text: Optional[str] = None,
        context_before: Optional[str] = None,
        context_after: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a teaching interaction"""
        try:
            # Create the system message that sets up Claude as a student
            system_message = """You are now in 'learning mode' as Clarity, an AI student eager to learn from the user. Your role is to:
            1. Act as a curious and engaged student learning from the user
            2. Ask thoughtful questions that help the user explain concepts more clearly
            3. Demonstrate progressive understanding by relating new information to what you've learned
            4. Identify potential gaps or unclear areas in the explanation
            5. Provide constructive feedback on the user's teaching effectiveness
            6. Help reinforce the user's understanding through the teaching process
            
            Maintain a friendly, encouraging tone while staying focused on learning from the user.
            Ask questions that make the user think deeply about the concept they're teaching."""

            # Build the messages array with proper typing
            messages: List[MessageParam] = [
                {
                    "role": "assistant",
                    "content": system_message
                }
            ]

            # Add document context if provided
            if document_text:
                messages.append({
                    "role": "user",
                    "content": f"I'll be teaching you about this document: {document_text}"
                })
                messages.append({
                    "role": "assistant",
                    "content": "I'm ready to learn about this document. Please explain the concepts to me, and I'll ask questions to better understand them."
                })

            # Add selected text context if provided
            if selected_text:
                context_msg = f"Let me teach you about this specific part: {selected_text}"
                if context_before:
                    context_msg = f"Before this, the document says: {context_before}\n\n" + context_msg
                if context_after:
                    context_msg += f"\n\nAfter this, the document continues with: {context_after}"
                messages.append({
                    "role": "user",
                    "content": context_msg
                })

            # Add the user's current message
            messages.append({
                "role": "user",
                "content": message
            })

            # Get response from Claude
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=messages,
                    temperature=0.7
                )

                # Extract the response message and usage information
                content = ""
                for block in response.content:
                    if isinstance(block, ContentBlock) and block.type == "text":
                        content = block.text
                        break

                # If no text content was found, use a default message
                if not content:
                    content = "I couldn't process that properly. Could you explain it again?"

                # Get usage information safely
                input_tokens = getattr(response.usage, "input_tokens", 0)
                output_tokens = getattr(response.usage, "output_tokens", 0)
                total_tokens = getattr(response.usage, "total_tokens", 0)

                # Update token usage if we have a document ID
                if document_id and response.usage:
                    self._update_token_usage(
                        document_id,
                        input_tokens,
                        output_tokens
                    )

                return {
                    "success": True,
                    "message": content,
                    "model": self.model,
                    "usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": total_tokens
                    }
                }

            except Exception as e:
                logger.error(f"Error in teaching interaction: {str(e)}")
                return {
                    "success": False,
                    "message": f"I had trouble processing that. Could you try explaining it again? Error: {str(e)}",
                    "model": self.model,
                    "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
                }

        except Exception as e:
            logger.error(f"Error in teaching session: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    def _update_token_usage(self, document_id: str, input_tokens: int, output_tokens: int) -> None:
        """Update token usage statistics for a document"""
        if document_id not in self._token_usage_cache:
            self._token_usage_cache[document_id] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0
            }
        
        self._token_usage_cache[document_id]["input_tokens"] += input_tokens
        self._token_usage_cache[document_id]["output_tokens"] += output_tokens
        self._token_usage_cache[document_id]["total_tokens"] += input_tokens + output_tokens 