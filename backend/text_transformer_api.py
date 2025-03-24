import os
import logging
import traceback
from enum import Enum
from typing import Dict, Any, Optional, List, cast
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client - using AsyncOpenAI for async operations
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not configured")

client = AsyncOpenAI(api_key=api_key)  

# Create a router for transformer endpoints without prefix - we'll specify full paths
router = APIRouter(tags=["transformer"])

class TransformationType(str, Enum):
    SIMPLIFY = "simplify"
    SOPHISTICATE = "sophisticate"
    CASUALISE = "casualise"
    FORMALISE = "formalise"

class TransformRequest(BaseModel):
    text: str
    transformationType: TransformationType
    level: int
    isLecture: bool = False
    documentText: Optional[str] = None

class TransformResponse(BaseModel):
    transformedText: str
    transformationType: TransformationType
    level: int
    model: str
    usage: Dict[str, Any]

def get_model_for_level(transform_type: TransformationType, level: int) -> str:
    """
    Determine which model to use based on transformation level
    - Levels 1-2: GPT-3.5 Turbo
    - Levels 3-5: GPT-4
    """
    if level <= 2:
        return "gpt-3.5-turbo"
    else:
        return "gpt-4"

def get_system_message(transform_type: TransformationType, level: int) -> str:
    """Get the system message for the GPT model based on transformation type and level"""
    base_message = "You are a helpful assistant that transforms text. "
    
    if transform_type == TransformationType.SIMPLIFY:
        level_descriptions = {
            1: "Simplify to elementary school level (age 7-8). Use basic words and very short sentences.",
            2: "Simplify to middle school level (age 10-11). Use simple words with some subject-specific terms.",
            3: "Simplify to early high school level (age 13-14). Use moderate vocabulary with mixed sentence structure.",
            4: "Simplify to GCSE level. Use standard vocabulary with some technical terms.",
            5: "Simplify to A-Level. Keep content clear but academically sophisticated."
        }
        return base_message + level_descriptions.get(level, f"Simplify to level {level}.")
    
    elif transform_type == TransformationType.SOPHISTICATE:
        level_descriptions = {
            1: "Make professional with moderate formality. Use business language.",
            2: "Make undergraduate academic. Use scholarly tone with theoretical concepts.",
            3: "Make graduate academic. Use advanced concepts and field-specific terms.",
            4: "Make expert/specialist level. Use technical language and complex frameworks.",
            5: "Make advanced academic publication style. Use sophisticated academic language."
        }
        return base_message + level_descriptions.get(level, f"Make sophisticated to level {level}.")
    
    elif transform_type == TransformationType.CASUALISE:
        level_descriptions = {
            1: "Make polite casual. Keep formal structure but add some friendliness.",
            2: "Make relaxed. Use some contractions and simplified wording.",
            3: "Make very casual. Use contractions, simpler vocabulary, and a conversational tone.",
            4: "Make super casual. Use short sentences, slang, and very informal language.",
            5: "Make ultra casual. Use extremely informal language, slang, and casual expressions."
        }
        return base_message + level_descriptions.get(level, f"Make casual to level {level}.")
    
    elif transform_type == TransformationType.FORMALISE:
        level_descriptions = {
            1: "Make basic professional. Use proper grammar and avoid contractions.",
            2: "Make business formal. Use professional language and structured sentences.",
            3: "Make executive level. Use sophisticated business language and formal structure.",
            4: "Make legal/corporate formal. Use precise terminology and complex formal structures.",
            5: "Make diplomatic/governmental formal. Use highly formal language and elaborate structures."
        }
        return base_message + level_descriptions.get(level, f"Make formal to level {level}.")
    
    else:
        return base_message + f"Transform the text to level {level}."

async def transform_text_with_gpt(
    text: str,
    transform_type: TransformationType,
    level: int
) -> Dict[str, Any]:
    """Transform text using GPT-3.5 or GPT-4 based on level"""
    try:
        # Select model based on level
        model = get_model_for_level(transform_type, level)
        logger.info(f"Selected model {model} for level {level}")
        
        # Create system message based on transformation type and level
        system_message = get_system_message(transform_type, level)
        
        # Log request details
        logger.info(f"Transform request - Model: {model}, Type: {transform_type}, Level: {level}")
        
        # Prepare messages with proper type annotations
        messages = [
            ChatCompletionSystemMessageParam(role="system", content=system_message),
            ChatCompletionUserMessageParam(role="user", content=text)
        ]
            
        # Send request to OpenAI
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=1000,
            top_p=1.0,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )
        
        # Extract response data
        transformed_text = response.choices[0].message.content if response.choices else ""
        usage_data = response.usage.model_dump() if response.usage else {}
        
        return {
            "transformedText": transformed_text,
            "transformationType": transform_type,
            "level": level,
            "model": model,
            "usage": usage_data
        }
            
    except Exception as e:
        error_msg = f"Error in transform_text_with_gpt: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@router.post("/api/transformer", response_model=TransformResponse)
async def transform_text(request: TransformRequest):
    """Transform text using GPT based on the specified parameters"""
    try:
        if not request.text:
            logger.warning("Transform request with empty text")
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(request.text) > 250:
            logger.warning(f"Text exceeds character limit: {len(request.text)}")
            raise HTTPException(status_code=400, detail="Text exceeds maximum length of 250 characters")
        
        logger.info(f"Transform request - Type: {request.transformationType}, Level: {request.level}")
        
        # Call the transform function
        result = await transform_text_with_gpt(
            text=request.text,
            transform_type=request.transformationType,
            level=request.level
        )
        
        logger.info("Transform complete")
        return result
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error transforming text: {str(e)}")
        logger.error(f"Error details: {type(e).__name__}")
        logger.error(f"Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Error transforming text: {str(e)}"
        )

@router.get("/api/transformer")
async def transformer_health_check():
    """Health check endpoint for the transformer API"""
    try:
        logger.info("Transformer health check requested")
        return {
            "status": "ok",
            "message": "Transformer API is running",
            "models": {
                "gpt-3.5-turbo": "Available for levels 1-2",
                "gpt-4": "Available for levels 3-5"
            }
        }
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Transformer health check failed: {str(e)}"
        ) 