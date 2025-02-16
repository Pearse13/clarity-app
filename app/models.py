from pydantic import BaseModel, Field, validator
from enum import Enum
import re

class TransformationType(str, Enum):
    SIMPLIFY = "simplify"
    SOPHISTICATE = "sophisticate"

class TransformRequest(BaseModel):
    text: str = Field(
        ..., 
        max_length=250,
        description="The text to transform (max 250 characters)"
    )
    transformationType: TransformationType = Field(
        ...,
        description="The type of transformation to apply (simplify or sophisticate)"
    )
    level: int = Field(
        ..., 
        ge=1, 
        le=5,
        description="The level of transformation (1-5)"
    )

    @validator("text")
    def text_must_be_valid(cls, v):
        # Remove any null bytes
        v = v.replace("\0", "")
        
        # Remove any control characters except newlines and tabs
        v = "".join(char for char in v if char == "\n" or char == "\t" or not re.match(r"[\x00-\x1f\x7f-\x9f]", char))
        
        # Check if text is empty after cleaning
        if not v.strip():
            raise ValueError("Text cannot be empty")
            
        # Check for potential script injection
        if re.search(r"<script|javascript:|data:", v, re.IGNORECASE):
            raise ValueError("Text contains potentially unsafe content")
            
        return v.strip()

class TransformResponse(BaseModel):
    transformedText: str
    transformationType: TransformationType
    level: int
    usage_info: dict