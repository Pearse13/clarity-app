"""Application configuration."""
from typing import List
from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    """Application settings."""
    # CORS settings
    cors_origins: List[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:3000",  # Next.js dev server
        "http://localhost:8000",  # Backend API
        "https://clarity-app-pearse13.vercel.app",  # Production frontend
        "http://localhost:5174",  # Development frontend
        "*",  # Allow all origins in production
    ]
    
    # OpenAI settings
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "your-api-key-here")
    
    # Auth0 settings
    auth0_domain: str = "dev-8utndajax3l877vt.us.auth0.com"
    auth0_client_id: str = "eLvP3nx8vXQoopKdQESozCJmJAqZiPLg"
    auth0_client_secret: str = "your_auth0_client_secret_here"
    auth0_callback_url: str = "http://localhost:5174/callback"
    auth0_audience: str = "https://clarity-api.com"
    
    # Security settings
    secret_key: str = "your_secret_key_here"
    algorithm: str = "RS256"
    access_token_expire_minutes: int = 1440
    
    # Database settings
    database_url: str = "sqlite:///./clarity.db"
    
    # API settings
    project_name: str = "clarity-api"
    api_v1_str: str = "/api/v1"
    
    class Config:
        env_file = None  # Disable .env file loading
        case_sensitive = True

# Initialize settings
settings = Settings() 