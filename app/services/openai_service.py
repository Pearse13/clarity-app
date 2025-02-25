import openai
import logging
import os
from app.models import TransformationType

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

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

async def transform_text_with_gpt(text: str, transform_type: TransformationType, level: int) -> tuple[str, dict]:
    try:
        from main import client  # Import the client from main.py
        
        logger.debug("Creating prompt...")
        prompt = create_prompt(text, transform_type, level)
        logger.debug(f"Created prompt: {prompt}")
        
        logger.debug("Sending request to OpenAI...")
        logger.debug("Using model: gpt-3.5-turbo")
        
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7
        )
        
        logger.debug("Successfully received response from OpenAI")
        return response.choices[0].message.content, {"usage": {"total_tokens": response.usage.total_tokens}}
    except Exception as e:
        logger.error(f"Error in transform_text_with_gpt: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        raise Exception(f"OpenAI API error: {str(e)}")