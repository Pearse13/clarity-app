"""Application configuration."""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, DirectoryPath, computed_field
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_prefix="",
        env_file_encoding="utf-8",
        validate_assignment=True,
        use_enum_values=True,
        protected_namespaces=('model_', 'settings_')
    )
    
    # Environment
    environment: str = Field(default=os.getenv("ENVIRONMENT", "development"), description="Current environment")
    
    # Base URLs
    public_url: str = Field(default=os.getenv("PUBLIC_URL", "http://localhost:8000"), description="Public URL for file access")
    
    # CORS settings
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:5173",  # Vite default
            "http://localhost:5174",  # Alternative Vite port
            "http://localhost:3000",  # Common React port
            "https://clarity-app.vercel.app",  # Vercel deployment
            "https://clarity-lectures.vercel.app",  # Lecture app deployment
            "https://clarity-app-git-main-pearse13.vercel.app",  # Vercel preview
            "*"  # Allow all origins during development - remove in production
        ],
        description="Allowed CORS origins"
    )
    
    # File storage settings
    upload_dir: str = Field(
        default=os.getenv(
            "UPLOAD_DIR",
            "app/static/uploads"  # Changed to be under static directory
        ),
        description="Upload directory path"
    )
    temp_dir: str = Field(
        default=os.getenv(
            "TEMP_DIR",
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "temp")
        ),
        description="Temporary directory path"
    )
    max_file_size: int = Field(default=20 * 1024 * 1024, description="Maximum file size in bytes")  # 20MB
    
    # OpenAI settings
    openai_api_key: Optional[str] = Field(default=os.getenv("OPENAI_API_KEY"), description="OpenAI API key")
    
    # Auth0 settings
    auth0_domain: Optional[str] = Field(default=os.getenv("AUTH0_DOMAIN"), description="Auth0 domain")
    auth0_client_id: Optional[str] = Field(default=os.getenv("AUTH0_CLIENT_ID"), description="Auth0 client ID")
    auth0_client_secret: Optional[str] = Field(default=os.getenv("AUTH0_CLIENT_SECRET"), description="Auth0 client secret")
    auth0_callback_url: str = Field(default="http://localhost:5174/callback", description="Auth0 callback URL")
    auth0_audience: Optional[str] = Field(default=os.getenv("AUTH0_AUDIENCE"), description="Auth0 audience")
    
    # Security settings
    secret_key: str = Field(default="your_secret_key_here", description="Secret key for JWT")
    algorithm: str = Field(default="RS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(default=1440, description="Access token expiry in minutes")
    
    # Database settings
    database_url: str = Field(default="sqlite:///./clarity.db", description="Database URL")
    
    # API settings
    project_name: str = Field(default="clarity-api", description="Project name")
    api_v1_str: str = Field(default="/api/v1", description="API version string")
    
    # Sentry settings
    sentry_dsn: Optional[str] = Field(default=os.getenv("SENTRY_DSN"), description="Sentry DSN")
    
    # Production domain
    production_domain: Optional[str] = Field(default=os.getenv("PRODUCTION_DOMAIN"), description="Production domain")
    
    # Rate limiting
    rate_limit_max_requests: int = Field(
        default=int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "50")),
        description="Maximum requests per window"
    )
    rate_limit_window_ms: int = Field(
        default=int(os.getenv("RATE_LIMIT_WINDOW_MS", "60000")),
        description="Rate limit window in milliseconds"
    )
    
    # CloudConvert API key
    cloudconvert_api_key: str = Field(
        default="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiMzJiOGU0YTViMWViNDUyYzA1ODg0ODFjNTkxOGFkMmIyMGQ3YzdhODdhOWMzZTBiM2Q1YWY4NzMzNjg4NGQxNzI0OTczMzY2OTdkMzAzNTMiLCJpYXQiOjE3NDI1Njg3NjEuMDExNDAzLCJuYmYiOjE3NDI1Njg3NjEuMDExNDA0LCJleHAiOjQ4OTgyNDIzNjEuMDA1NTM1LCJzdWIiOiI3MTQwNTY3NCIsInNjb3BlcyI6WyJ0YXNrLnJlYWQiLCJ0YXNrLndyaXRlIl19.mgYVRfvltwxppGKKJFk9SHRMyEToYOCu7WKiLuBVwGEc0X6SLX9Zan2n8cqFlFOqKFTa4kIaNjIYLrHNbx1lz1tJbgXWI-GgneNXBZ8Il79RdqAUdM190-nUXh0GjApXpY6JCdgu2neNCy2WoI1lZ61Yv0sjUkh5goUT9G5vAlNCWK-434jq2xKwhU34bOFPA4lH4slQaKY_2JfHWPeVMVktJZkrIyv8FLoan-ig_iTp2-POW6qZ_Xfh1v90mhAqhjP31zZsMQaRTsufd8kpP2pB1575lVVi7SbWbJ4p-0n7Xrujno4JJws8NUMMrJijaviROaZ7ljDOi0oGiXqgaJZygO0vB0ejbSd7hAgAHTAfN7P7RePAs7qiZ9G1YfFbBhbqkrvUo321gGKFVPLx0zJjpdp-ZoDv0fHebHmlzZm3uci8CFAb1cyIs8sSf_oq4yrJ99_0ysg-yNMUAMI7912ycjXnWDX4WBOKo20ZiAQK2N0KiB0lF3gqbgTgQjPeMBLL3WLHsJsS3XMtoPKPL-mbuY0e0LC1C5Ql5dNA2Nuybc-roXKsGfCaikAHKJ4NaB0kCSTxY2boLfaLkjWrQqQkmOxVxgWig0eUQEvNiM3NzGshd1DUi6NlyHsMi3xj_6iydipiyVNRDCCdtrv8f-aHMKUDVzLVS3zzTQa0jwI"
    )
    
    def __init__(self, **data):
        super().__init__(**data)
        # Convert paths to absolute paths and ensure they exist
        self._upload_dir = str(Path(self.upload_dir).resolve())
        self._temp_dir = str(Path(self.temp_dir).resolve())
        # Create directories if they don't exist
        Path(self._upload_dir).mkdir(parents=True, exist_ok=True)
        Path(self._temp_dir).mkdir(parents=True, exist_ok=True)
        # Update the original fields
        self.upload_dir = self._upload_dir
        self.temp_dir = self._temp_dir

    @property
    def upload_path(self) -> Path:
        """Get the upload directory as a Path object."""
        return Path(self.upload_dir)

    @property
    def temp_path(self) -> Path:
        """Get the temp directory as a Path object."""
        return Path(self.temp_dir)

# Initialize settings
settings = Settings() 