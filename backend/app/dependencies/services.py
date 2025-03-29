from ..services.anthropic_service import AnthropicService
from typing import Optional

# Singleton instance of AnthropicService
_anthropic_service: Optional[AnthropicService] = None

def get_anthropic_service() -> AnthropicService:
    """
    Dependency that provides a singleton instance of AnthropicService
    """
    global _anthropic_service
    if _anthropic_service is None:
        _anthropic_service = AnthropicService()
    return _anthropic_service 