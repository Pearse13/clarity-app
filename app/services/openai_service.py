import os
import logging
from typing import Dict, Optional, Any, Tuple, List
import openai
from openai import OpenAI
from app.models import TransformationType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API
api_key = os.getenv('OPENAI_API_KEY')
if not api_key:
    logger.error("OpenAI API key not found in environment variables")
    raise ValueError("OpenAI API key not configured")

# Initialize OpenAI client
client = OpenAI(api_key=api_key)

# Model configuration
TRANSFORM_MODEL = "gpt-3.5-turbo"  # Model for text transformations
LECTURE_MODEL = "gpt-4"  # Model for lecture understanding

def create_prompt(text: str, transform_type: TransformationType, level: int, context: Optional[Dict[str, Any]] = None) -> str:
    """Create a prompt for the OpenAI API based on the transformation type and level."""
    
    # Base prompts by transformation type
    if transform_type == TransformationType.SIMPLIFY:
        base_prompt = f"Please rewrite the following text to make it easier to understand (level {level}/5, where 5 is extremely simple). Maintain the original meaning, but use simpler vocabulary and sentence structure."
    elif transform_type == TransformationType.SOPHISTICATE:
        base_prompt = f"Please rewrite the following text using more sophisticated language (level {level}/5, where 5 is highly sophisticated). Use advanced vocabulary and complex sentence structures while preserving the original meaning."
    elif transform_type == TransformationType.CASUALISE:
        base_prompt = f"Please rewrite the following text to make it more casual and conversational (level {level}/5, where 5 is extremely casual). Use informal language, contractions, and a friendly tone while maintaining the core message."
    else:
        base_prompt = f"Please rewrite the following text (level {level}/5)."
    
    # Add context information if provided
    context_section = ""
    if context and any(context.values()):
        context_section = "\n\nWhen rewriting, consider the following context information:"
        
        if context.get('document_title'):
            context_section += f"\n- This text is from a document titled: {context['document_title']}"
            
        if context.get('key_terms') and len(context['key_terms']) > 0:
            terms = ', '.join(context['key_terms'][:5])  # Limit to first 5 terms
            context_section += f"\n- Key terms in the document: {terms}"
            
        if context.get('surrounding_context'):
            context_section += f"\n- Surrounding context: \"{context['surrounding_context']}\""
            
        context_section += "\n\nMaintain technical accuracy and domain-specific terminology while applying the requested transformation."
    
    # Combine everything
    full_prompt = f"{base_prompt}{context_section}\n\nText to rewrite: \"{text}\"\n\nRewritten text:"
    
    return full_prompt

async def transform_text_with_gpt(text: str, transform_type: TransformationType, level: int, is_lecture: bool = False, context: Optional[Dict[str, Any]] = None) -> Tuple[str, Dict[str, Any]]:
    """Transform text using OpenAI GPT and return the transformed text and usage info."""
    
    try:
        # Create prompt with context (if provided)
        prompt = create_prompt(text, transform_type, level, context)
        
        # Track if context was applied
        context_applied = bool(context and any(context.values()))
        
        # Select model based on the use case
        selected_model = LECTURE_MODEL if is_lecture else TRANSFORM_MODEL
        
        # Make the API request
        response = client.chat.completions.create(
            model=selected_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.7,
            top_p=1.0,
        )
        
        # Extract the transformed text
        transformed_text = ""
        if response.choices and response.choices[0].message.content:
            transformed_text = response.choices[0].message.content.strip()
        
        # Clean up any artifacts
        if transformed_text.startswith('"') and transformed_text.endswith('"'):
            transformed_text = transformed_text[1:-1]
        
        # Prepare usage information
        usage_info = {
            "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') and response.usage else 0,
            "model": selected_model,
            "context_applied": context_applied
        }
        
        # Return the transformed text and usage info
        return transformed_text, usage_info
        
    except Exception as e:
        logger.error(f"Error transforming text: {str(e)}")
        raise