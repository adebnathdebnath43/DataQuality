from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # AWS Configuration
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0"
    s3_metadata_prefix: str = "metadata/"
    
    # Application Configuration
    local_dev: bool = True
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # API Configuration
    api_title: str = "Aether Data Quality API"
    api_version: str = "1.0.0"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
