"""Application configuration."""
from typing import List, Optional
from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    """Application settings."""
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    
    # CORS settings
    cors_origins: List[str] = [
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:3000",  # Common React port
        "https://clarity-app.vercel.app",  # Vercel deployment
        "https://clarity-lecture.vercel.app",  # Lecture app deployment
        "https://clarity-app-git-main-pearse13.vercel.app",  # Vercel preview
        "*"  # Allow all origins during development - remove in production
    ]
    
    # OpenAI settings
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    
    # Auth0 settings
    auth0_domain: Optional[str] = os.getenv("AUTH0_DOMAIN")
    auth0_client_id: Optional[str] = os.getenv("AUTH0_CLIENT_ID")
    auth0_client_secret: Optional[str] = os.getenv("AUTH0_CLIENT_SECRET")
    auth0_callback_url: str = "http://localhost:5174/callback"
    auth0_audience: Optional[str] = os.getenv("AUTH0_AUDIENCE")
    
    # Security settings
    secret_key: str = "your_secret_key_here"
    algorithm: str = "RS256"
    access_token_expire_minutes: int = 1440
    
    # Database settings
    database_url: str = "sqlite:///./clarity.db"
    
    # API settings
    project_name: str = "clarity-api"
    api_v1_str: str = "/api/v1"
    
    # Sentry settings
    sentry_dsn: Optional[str] = os.getenv("SENTRY_DSN")
    
    # Production domain
    production_domain: Optional[str] = os.getenv("PRODUCTION_DOMAIN")
    
    # Rate limiting
    rate_limit_max_requests: int = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "50"))
    rate_limit_window_ms: int = int(os.getenv("RATE_LIMIT_WINDOW_MS", "60000"))
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Initialize settings
settings = Settings() 