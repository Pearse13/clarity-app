from typing import List, Optional
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    environment: str
    debug: bool
    public_url: str
    cors_origins: List[str]
    upload_dir: str
    temp_dir: str
    documents_dir: str
    max_file_size: int
    openai_api_key: Optional[str]
    auth0_domain: Optional[str]
    auth0_client_id: Optional[str]
    auth0_client_secret: Optional[str]
    auth0_callback_url: str
    auth0_audience: Optional[str]
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    database_url: str
    project_name: str
    api_v1_str: str
    sentry_dsn: Optional[str]
    production_domain: Optional[str]
    rate_limit_max_requests: int
    rate_limit_window_ms: int
    cloudconvert_api_key: Optional[str]
    
    @property
    def upload_path(self) -> Path: ...
    
    @property
    def temp_path(self) -> Path: ...
    
    @property
    def documents_path(self) -> Path: ...

settings: Settings 