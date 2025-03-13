import os
from openai import AsyncOpenAI, APIError, RateLimitError, AuthenticationError
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam
from typing import Optional, Dict, Any, Tuple, List, TypedDict, cast
from app.models import TransformationType
import logging
import httpx
from fastapi import HTTPException
import asyncio
import traceback

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure OpenAI with async client
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not configured")

api_key = api_key.strip()

# Initialize OpenAI client
client = AsyncOpenAI(
    api_key=api_key,
    timeout=60.0
)

class MessageDict(TypedDict):
    role: str
    content: str

# Model configuration
TRANSFORM_MODEL = "gpt-3.5-turbo"  # Model for text transformations
LECTURE_MODEL = "gpt-4"  # Model for lecture understanding

def create_prompt(text: str, transform_type: TransformationType, level: int) -> str:
    if transform_type == TransformationType.SIMPLIFY:
        return f"""Rewrite this text in the simplest possible way for a {level} grade reading level.
Level 1: Use only basic words a 5-year-old would understand. Use very short sentences.
Level 2: Use simple words a 7-year-old would understand. Keep sentences short.
Level 3: Use words a 9-year-old would understand. Sentences can be a bit longer.
Level 4: Use words a 11-year-old would understand. Normal sentence length.
Level 5: Use words a 13-year-old would understand. Regular sentence structure.

Current level: {level}
Rules:
- Replace any difficult words with simpler ones
- Break long sentences into shorter ones
- Use active voice
- Explain things clearly

Original text: {text}"""
    else:
        return f"""Rewrite this text with sophisticated language at level {level} 
(where 1 means slightly formal and 5 means highly academic/professional).
Use more advanced vocabulary, complex sentence structures, and elegant phrasing.
Original text: {text}"""

async def transform_text_with_gpt(text: str, transform_type: TransformationType, level: int, is_lecture: bool = False) -> tuple[str, dict]:
    try:
        from main import client  # Import the client from main.py
        
        logger.debug("Creating prompt...")
        prompt = create_prompt(text, transform_type, level)
        logger.debug(f"Created prompt: {prompt}")
        
        # Select model based on the use case
        selected_model = LECTURE_MODEL if is_lecture else TRANSFORM_MODEL
        logger.debug(f"Using model: {selected_model}")
        
        try:
            response = await client.chat.completions.create(
                model=selected_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.7,
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            logger.debug(f"Successfully used {selected_model}")
            
            # Safely handle response content
            content = ""
            if response.choices and response.choices[0].message.content is not None:
                content = str(response.choices[0].message.content)
            
            # Safely handle usage data
            usage_data = {
                "total_tokens": 0,
                "model": selected_model
            }
            
            if response.usage is not None:
                usage_data["total_tokens"] = getattr(response.usage, "total_tokens", 0)
            
            return content, {
                "usage": usage_data
            }
            
        except Exception as model_error:
            logger.error(f"Error with {selected_model}: {str(model_error)}")
            raise Exception(f"OpenAI API error with {selected_model}: {str(model_error)}")
            
    except Exception as e:
        logger.error(f"Error in transform_text_with_gpt: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        raise Exception(f"OpenAI API error: {str(e)}")

async def call_openai_api(messages: List[MessageDict]) -> Tuple[str, Dict[str, Any]]:
    try:
        # Convert messages to proper ChatCompletionMessageParam format
        formatted_messages: List[ChatCompletionMessageParam] = []
        for msg in messages:
            if msg["role"] == "system":
                formatted_messages.append(cast(ChatCompletionSystemMessageParam, {"role": "system", "content": msg["content"]}))
            else:
                formatted_messages.append(cast(ChatCompletionUserMessageParam, {"role": "user", "content": msg["content"]}))
        
        response: ChatCompletion = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=formatted_messages
        )
        
        # Safely handle response content with explicit type handling
        content: str = ""
        if response.choices and response.choices[0].message.content is not None:
            content = str(response.choices[0].message.content)
        
        # Safely handle usage data with proper type checking
        usage: Dict[str, Any] = {}
        if response.usage is not None:
            try:
                usage = response.usage.model_dump()
            except AttributeError:
                # Fallback if model_dump is not available
                if hasattr(response.usage, "prompt_tokens"):
                    usage["prompt_tokens"] = response.usage.prompt_tokens
                if hasattr(response.usage, "completion_tokens"):
                    usage["completion_tokens"] = response.usage.completion_tokens
                if hasattr(response.usage, "total_tokens"):
                    usage["total_tokens"] = response.usage.total_tokens
        
        return content, usage
    except Exception as e:
        return "", {"error": str(e)}