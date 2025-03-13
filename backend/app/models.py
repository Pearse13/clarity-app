from enum import Enum
from pydantic import BaseModel
from typing import Optional

class TransformationType(Enum):
    SIMPLIFY = "simplify"
    SOPHISTICATE = "sophisticate"
    CASUALISE = "casualise"
    FORMALISE = "formalise"

class TransformRequest(BaseModel):
    text: str
    transformationType: TransformationType
    level: int = 1
    isLecture: bool = False

class TransformResponse(BaseModel):
    transformedText: str
    transformationType: TransformationType
    level: int
    usage: dict 