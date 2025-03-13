import os
from openai import AsyncOpenAI, APIError, RateLimitError, AuthenticationError
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam
from typing import Optional, Dict, Any, Tuple, List, TypedDict, cast
from ..models import TransformationType
import logging
import httpx
from fastapi import HTTPException
import asyncio
import traceback

# Configure detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure OpenAI with async client
api_key = os.getenv('OPENAI_API_KEY')
if api_key:
    # Clean the API key by removing any whitespace or newline characters
    api_key = api_key.strip()

logger.debug(f"API Key found: {'Yes' if api_key else 'No'}")
logger.debug(f"API Key length: {len(api_key) if api_key else 0}")
logger.debug(f"API Key prefix: {api_key[:8] + '...' if api_key else 'None'}")

if not api_key:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not configured")

logger.info("Initializing OpenAI client")
try:
    client = AsyncOpenAI(
        api_key=api_key,
        timeout=60.0  # 60 second timeout
    )
    logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {str(e)}")
    logger.error(f"Error type: {type(e).__name__}")
    logger.error(f"Error traceback: {traceback.format_exc()}")
    raise

class MessageDict(TypedDict):
    role: str
    content: str

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
        
        # Safely handle response and usage
        content = response.choices[0].message.content if response.choices else ""
        usage = response.usage.model_dump() if response.usage else {}
        
        # Ensure content is never None
        return content or "", usage
    except Exception as e:
        return "", {"error": str(e)}

async def transform_text_with_gpt(
    text: str,
    transform_type: TransformationType,
    level: int,
    is_lecture: bool = False
) -> Dict[str, Any]:
    """Transform text using GPT-4 or GPT-3.5-turbo based on level"""
    try:
        # Select model based on level
        model = "gpt-3.5-turbo" if level in [2, 3] else "gpt-4"
        logger.info(f"Selected model {model} for level {level}")
        
        # Create system message based on transformation type and level
        system_message = get_system_message(transform_type, level, is_lecture)
        
        logger.info(f"Request details:")
        logger.info(f"- Model: {model}")
        logger.info(f"- Type: {transform_type}")
        logger.info(f"- Level: {level}")
        logger.info(f"- Text length: {len(text)} characters")
        logger.info(f"- System message: {system_message}")
        
        # Format messages properly for OpenAI API
        messages: List[ChatCompletionMessageParam] = [
            cast(ChatCompletionSystemMessageParam, {"role": "system", "content": system_message}),
            cast(ChatCompletionUserMessageParam, {"role": "user", "content": text})
        ]
        
        response: ChatCompletion = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1000,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )
        
        # Safely access response attributes
        transformed_text = response.choices[0].message.content if response.choices else ""
        usage_data = response.usage.model_dump() if response.usage else {}
        
        return {
            "text": transformed_text,
            "usage": usage_data
        }
            
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error in transform_text_with_gpt: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full request details - Text length: {len(text)}, Type: {transform_type}, Level: {level}, Model: {model}")
        return {
            "error": error_msg,
            "usage": {}
        }

def get_system_message(transform_type: TransformationType, level: int, is_lecture: bool) -> str:
    """Get the system message for the GPT model based on transformation type and level"""
    base_message = "You are a helpful assistant that transforms text. "
    
    if transform_type == TransformationType.SIMPLIFY:
        return base_message + f"Simplify the text to a level {level} (1=elementary, 5=high school). Maintain key information while making it easier to understand."
    elif transform_type == TransformationType.SOPHISTICATE:
        return base_message + f"Make the text more sophisticated to level {level} (1=professional, 5=academic expert). Enhance vocabulary and complexity while maintaining clarity."
    elif transform_type == TransformationType.CASUALISE:
        return base_message + f"Make the text more casual to level {level} (1=friendly, 5=very informal). Maintain meaning while making it more conversational."
    elif transform_type == TransformationType.FORMALISE:
        return base_message + f"Make the text more formal to level {level} (1=business, 5=legal/technical). Increase professionalism while maintaining clarity."
    else:
        raise ValueError(f"Unknown transformation type: {transform_type}") 