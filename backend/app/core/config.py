"""Application configuration."""
from typing import List, Optional, Union, TypeVar, Any, Dict
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, DirectoryPath, computed_field
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

T = TypeVar('T')

class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        env_prefix="",
        env_file_encoding="utf-8",
        validate_assignment=True,
        use_enum_values=True,
        protected_namespaces=('model_', 'settings_'),
        extra='allow'  # Allow extra fields
    )
    
    # Environment
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    
    # Base URLs
    public_url: str = Field(default=os.getenv("PUBLIC_URL", "http://localhost:8000"))
    
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
    upload_dir: str = Field(default="app/static/uploads")
    temp_dir: str = Field(default="app/data/temp")
    documents_dir: str = Field(default="app/data/documents")
    max_file_size: int = Field(default=20 * 1024 * 1024)  # 20MB
    
    # OpenAI settings
    openai_api_key: Optional[str] = Field(default=os.getenv("OPENAI_API_KEY"), description="OpenAI API key")
    
    # Auth0 settings
    auth0_domain: Optional[str] = Field(default=os.getenv("AUTH0_DOMAIN"), description="Auth0 domain")
    auth0_client_id: Optional[str] = Field(default=os.getenv("AUTH0_CLIENT_ID"), description="Auth0 client ID")
    auth0_client_secret: Optional[str] = Field(default=os.getenv("AUTH0_CLIENT_SECRET"), description="Auth0 client secret")
    auth0_callback_url: str = Field(default="http://localhost:5174/callback", description="Auth0 callback URL")
    auth0_audience: Optional[str] = Field(default=os.getenv("AUTH0_AUDIENCE"), description="Auth0 audience")
    
    # Rate limiting settings with more granular controls
    rate_limit_max_requests: int = Field(
        default=int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "50")),
        description="Maximum requests per window"
    )
    rate_limit_window_ms: int = Field(
        default=int(os.getenv("RATE_LIMIT_WINDOW_MS", "60000")),
        description="Rate limit window in milliseconds"
    )
    auth_rate_limit_max_requests: int = Field(
        default=int(os.getenv("AUTH_RATE_LIMIT_MAX_REQUESTS", "10")),
        description="Maximum auth requests per window"
    )
    auth_rate_limit_window_ms: int = Field(
        default=int(os.getenv("AUTH_RATE_LIMIT_WINDOW_MS", "60000")),
        description="Auth rate limit window in milliseconds"
    )
    
    # Security settings
    secret_key: str = Field(
        default=os.getenv("SECRET_KEY", "your_secret_key_here"),
        description="Secret key for JWT"
    )
    algorithm: str = Field(default="RS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(
        default=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")),
        description="Access token expiry in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
        description="Refresh token expiry in days"
    )
    password_reset_token_expire_minutes: int = Field(
        default=int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "15")),
        description="Password reset token expiry in minutes"
    )
    min_password_length: int = Field(
        default=int(os.getenv("MIN_PASSWORD_LENGTH", "12")),
        description="Minimum password length"
    )
    
    # Database settings
    database_url: str = Field(default="sqlite:///./clarity.db", description="Database URL")
    
    # API settings
    project_name: str = Field(default="clarity-api", description="Project name")
    api_v1_str: str = Field(default="/api/v1", description="API version string")
    
    # Sentry settings
    sentry_dsn: Optional[str] = Field(default=os.getenv("SENTRY_DSN"), description="Sentry DSN")
    
    # Production domain
    production_domain: Optional[str] = Field(default=os.getenv("PRODUCTION_DOMAIN"), description="Production domain")
    
    # CloudConvert settings
    cloudconvert_api_key: Optional[str] = Field(default=os.getenv("CLOUDCONVERT_API_KEY"))
    
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

    @property
    def documents_path(self) -> Path:
        """Get the documents directory as a Path object."""
        return Path(self.documents_dir)

    def get_setting(self, name: str, default: T = None) -> T:
        """Get a setting by name with proper type casting."""
        return getattr(self, name, default)

    def validate_environment_variables(self) -> None:
        """Validate required environment variables on startup."""
        required_vars = {
            'AUTH0_DOMAIN': self.auth0_domain,
            'AUTH0_CLIENT_ID': self.auth0_client_id,
            'AUTH0_CLIENT_SECRET': self.auth0_client_secret,
            'AUTH0_AUDIENCE': self.auth0_audience,
            'SECRET_KEY': self.secret_key,
            'OPENAI_API_KEY': self.openai_api_key
        }
        
        missing_vars = [var for var, value in required_vars.items() if not value]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        # Validate URL format for domains
        if self.auth0_domain and not self.auth0_domain.startswith(('http://', 'https://')):
            self.auth0_domain = f"https://{self.auth0_domain}"
        
        # Validate token expiry times
        if self.access_token_expire_minutes < 1:
            raise ValueError("access_token_expire_minutes must be at least 1")
        
        if self.refresh_token_expire_days < 1:
            raise ValueError("refresh_token_expire_days must be at least 1")
        
        # Validate rate limits
        if self.rate_limit_max_requests < 1:
            raise ValueError("rate_limit_max_requests must be at least 1")
        
        if self.rate_limit_window_ms < 1000:
            raise ValueError("rate_limit_window_ms must be at least 1000")
        
        # Log non-sensitive configuration in development
        if self.environment == "development":
            print("Configuration validated successfully")
            print(f"Environment: {self.environment}")
            print(f"Debug mode: {self.debug}")
            print(f"API Version: {self.api_v1_str}")
            print(f"Rate limit: {self.rate_limit_max_requests} requests per {self.rate_limit_window_ms}ms")

# Initialize settings
settings = Settings()
settings.validate_environment_variables() 