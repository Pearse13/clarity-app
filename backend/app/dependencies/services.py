from ..services.teach_service import TeachService
from ..services.anthropic_service import AnthropicService
from typing import Optional

# Singleton instances
_teach_service = None
_anthropic_service = None

def get_teach_service() -> TeachService:
    """Get or create the TeachService singleton"""
    global _teach_service
    if _teach_service is None:
        _teach_service = TeachService()
    return _teach_service

def get_anthropic_service() -> AnthropicService:
    """Get or create the AnthropicService singleton"""
    global _anthropic_service
    if _anthropic_service is None:
        _anthropic_service = AnthropicService()
    return _anthropic_service 