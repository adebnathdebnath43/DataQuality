from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ExtractMetadataRequest(BaseModel):
    bucket: str
    keys: List[str]
    region: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    role_arn: Optional[str] = None
    model_id: Optional[str] = None

class FileProcessingResult(BaseModel):
    file_key: str
    status: str
    metadata_key: Optional[str] = None
    error: Optional[str] = None

class ExtractMetadataResponse(BaseModel):
    total_files: int
    successful: int
    failed: int
    results: List[FileProcessingResult]

class HealthResponse(BaseModel):
    status: str
    message: str
