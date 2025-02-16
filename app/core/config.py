from pydantic import BaseModel, Field
from dotenv import load_dotenv
import os
from typing import List

# Load environment variables first
load_dotenv()

def get_env_value(key: str, default: str = "") -> str:
    value = os.getenv(key)
    if value is None:
        return default
    return str(value).strip()

class Settings(BaseModel):
    API_KEY: str = Field(default_factory=lambda: get_env_value("API_KEY"))
    OPENAI_API_KEY: str = Field(default_factory=lambda: get_env_value("OPENAI_API_KEY"))
    ALLOWED_ORIGINS: str = Field(default="http://localhost:5173,http://10.107.224.33:5173")
    ENVIRONMENT: str = Field(default="development")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

# Create settings instance
settings = Settings()
