from fastapi import APIRouter, HTTPException, status
from app.models.schemas import (
    ExtractMetadataRequest,
    ExtractMetadataResponse,
    FileProcessingResult,
    HealthResponse
)
from app.services.metadata import MetadataService

router = APIRouter()
metadata_service = MetadataService()


@router.post("/extract-metadata", response_model=ExtractMetadataResponse)
async def extract_metadata(request: ExtractMetadataRequest):
    """
    Extract metadata from selected files using AWS Bedrock
    
    This endpoint:
    1. Reads files from S3
    2. Sends content to Claude 3.7 for analysis
    3. Stores extracted metadata as JSON in S3 (Iceberg-like structure)
    
    Returns processing results for all files
    """
    try:
        with open("C:/Users/soumi/Downloads/DataQuality/backend/debug_absolute.log", "a") as f:
            f.write(f"Endpoint hit: extract-metadata\n")
            f.write(f"Request: {request}\n")
            
        results = await metadata_service.process_files(
            bucket=request.bucket,
            file_keys=request.keys,
            region=request.region,
            access_key=request.access_key,
            secret_key=request.secret_key,
            role_arn=request.role_arn,
            model_id=request.model_id
        )
        
        successful = sum(1 for r in results if r["status"] == "success")
        failed = len(results) - successful
        
        return ExtractMetadataResponse(
            total_files=len(results),
            successful=successful,
            failed=failed,
            results=[FileProcessingResult(**r) for r in results]
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing files: {str(e)}"
        )


@router.get("/bedrock-models")
async def list_bedrock_models(region: str = None, access_key: str = None, secret_key: str = None):
    """
    List available Bedrock foundation models
    """
    try:
        print("Accessing /bedrock-models endpoint")
        from app.services.bedrock import BedrockService
        bedrock_service = BedrockService()
        models = bedrock_service.list_models(region, access_key, secret_key)
        print(f"Found models: {len(models)}")
        return {"models": models}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing models: {str(e)}"
        )


@router.get("/metadata/{bucket}/{file_key:path}")
async def get_metadata(bucket: str, file_key: str):
    """
    Retrieve stored metadata for a specific file
    
    Note: This is a placeholder. In production, you'd want a metadata index
    or catalog to efficiently look up metadata by source file.
    """
    try:
        metadata = await metadata_service.get_metadata(bucket, file_key)
        return metadata
        
    except NotImplementedError:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Metadata retrieval by file key not yet implemented. Use direct S3 path."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving metadata: {str(e)}"
        )


@router.get("/debug-s3/{bucket}")
async def debug_s3(bucket: str, region: str = None):
    """Debug S3 connection and listing"""
    import boto3
    import os
    from app.config import settings
    
    log = []
    def print_log(msg):
        log.append(str(msg))
        
    try:
        region = region or settings.aws_region
        print_log(f"Testing access to bucket: {bucket} in region: {region}")
        print_log(f"Settings AWS_REGION: {settings.aws_region}")
        
        # Create client
        client = boto3.client('s3', region_name=region)
        
        # List files
        print_log("Attempting to list files...")
        response = client.list_objects_v2(Bucket=bucket, Prefix="", Delimiter="/")
        
        print_log(f"Response HTTP StatusCode: {response['ResponseMetadata']['HTTPStatusCode']}")
        
        if 'CommonPrefixes' in response:
            print_log(f"Folders found: {len(response['CommonPrefixes'])}")
            for prefix in response['CommonPrefixes']:
                print_log(f" - {prefix['Prefix']}")
        else:
            print_log("No folders found.")
            
        if 'Contents' in response:
            print_log(f"Files found: {len(response['Contents'])}")
            for obj in response['Contents']:
                print_log(f" - {obj['Key']} ({obj['Size']} bytes)")
        else:
            print_log("No files found.")
            
        return {"status": "success", "log": log}
        
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "error": str(e), 
            "traceback": traceback.format_exc(),
            "log": log
        }


@router.get("/list-files/{bucket}")
async def list_files(bucket: str, prefix: str = "", region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None):
    """
    List files in an S3 bucket
    
    Args:
        bucket: S3 bucket name
        prefix: Optional prefix to filter files (folder path)
        region: AWS region of the bucket
        access_key: Optional AWS access key
        secret_key: Optional AWS secret key
        role_arn: Optional IAM Role ARN to assume
    
    Returns:
        List of files with metadata
    """
    try:
        from app.services.s3 import S3Service
        s3_service = S3Service()
        
        files = await s3_service.list_files(bucket, prefix, region, access_key, secret_key, role_arn)
        return {"files": files, "bucket": bucket, "prefix": prefix}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """API health check"""
    return HealthResponse(status="healthy", message="API is running")
