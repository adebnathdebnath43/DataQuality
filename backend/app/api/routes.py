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


@router.get("/ping")
async def ping():
    return {"message": "pong"}

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
@router.get("/file-content")
async def get_file_content(
    bucket: str, 
    key: str, 
    region: str = None, 
    access_key: str = None, 
    secret_key: str = None, 
    role_arn: str = None
):
    """
    Get content of a specific file from S3 (expecting JSON)
    """
    try:
        # Sanitize key
        key = key.strip()
        import urllib.parse
        key = urllib.parse.unquote(key)
        
        print(f"[ROUTE] /file-content called with bucket={bucket}, key={key}, region={region}")
        result = await metadata_service.get_file_content(bucket, key, region, access_key, secret_key, role_arn)
        
        # Check for duplicates if embedding exists
        if 'embedding' in result and result['embedding']:
            try:
                print("[ROUTE] Checking for duplicates...")
                all_local_results = metadata_service.get_all_local_results()
                duplicates = metadata_service.find_duplicates(result['embedding'], all_local_results)
                
                # Filter out the file itself (by key or name)
                duplicates = [d for d in duplicates if d['file_key'] != key and d['file_name'] != result.get('file_name')]
                
                if duplicates:
                    print(f"[ROUTE] Found {len(duplicates)} potential duplicates")
                    result['potential_duplicates'] = duplicates
            except Exception as e:
                print(f"[ROUTE] Error checking duplicates: {str(e)}")
                
        print(f"[ROUTE] Successfully retrieved file content")
        return result
    except FileNotFoundError as e:
        print(f"[ROUTE] File not found in S3: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"S3 File Not Found: {str(e)}"
        )
    except Exception as e:
        print(f"[ROUTE] Error reading file: {type(e).__name__}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file: {str(e)}"
        )

@router.get("/scan-results")
async def scan_results(
    bucket: str, 
    region: str = None, 
    access_key: str = None, 
    secret_key: str = None, 
    role_arn: str = None
):
    """
    Explicitly scan bucket for past analysis results
    """
    try:
        print(f"[ROUTE] /scan-results called for bucket={bucket}")
        result = await metadata_service.reconstruct_results(bucket, region, access_key, secret_key, role_arn)
        return result
    except Exception as e:
        print(f"[ROUTE] Error scanning results: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error scanning results: {str(e)}"
        )

@router.get("/history")
async def list_history():
    """List all local history files with duplicate detection"""
    try:
        history_files = metadata_service.list_local_history()
        
        # Get all results with embeddings for duplicate detection
        all_results = metadata_service.get_all_local_results()
        
        # Add duplicate information to each history file
        for history_file in history_files:
            try:
                # Load the full content of this history file
                content = metadata_service.get_local_history_content(history_file['filename'])
                
                # Get files from this history entry
                files = content.get('files', [])
                
                # Find duplicates for each file in this history
                duplicates_info = []
                for file_data in files:
                    if 'embedding' in file_data and file_data['embedding']:
                        # Find duplicates for this file
                        dups = metadata_service.find_duplicates(
                            file_data['embedding'], 
                            all_results,
                            threshold=0.95
                        )
                        # Filter out self
                        dups = [d for d in dups if d['file_name'] != file_data.get('file_name')]
                        if dups:
                            duplicates_info.extend(dups)
                
                # Add unique duplicates to history entry
                if duplicates_info:
                    # Get unique duplicates by file_name
                    unique_dups = {d['file_name']: d for d in duplicates_info}.values()
                    history_file['duplicates'] = list(unique_dups)
                    history_file['has_duplicates'] = True
                    history_file['max_similarity'] = max(d['similarity'] for d in unique_dups)
                else:
                    history_file['has_duplicates'] = False
                    
            except Exception as e:
                print(f"Error processing duplicates for {history_file['filename']}: {str(e)}")
                history_file['has_duplicates'] = False
        
        return history_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{filename}")
async def get_history_content(filename: str):
    """Get content of a specific history file with duplicate detection"""
    try:
        content = metadata_service.get_local_history_content(filename)
        
        # Get all results for duplicate detection
        all_results = metadata_service.get_all_local_results()
        
        # Add duplicate information to each file
        if 'files' in content and isinstance(content['files'], list):
            for file_data in content['files']:
                if 'embedding' in file_data and file_data['embedding']:
                    # Find duplicates for this file
                    duplicates = metadata_service.find_duplicates(
                        file_data['embedding'],
                        all_results,
                        threshold=0.95
                    )
                    # Filter out self
                    duplicates = [d for d in duplicates if d['file_name'] != file_data.get('file_name')]
                    if duplicates:
                        file_data['potential_duplicates'] = duplicates
        
        return content
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/scan-history")
async def get_scan_history(
    bucket: str,
    prefix: str = "",
    region: str = None,
    access_key: str = None,
    secret_key: str = None,
    role_arn: str = None,
    limit: int = 10
):
    """
    Get recent scan history for dashboard visualization
    Fetches and aggregates quality check results from S3
    """
    try:
        return await metadata_service.get_scan_history(bucket, prefix, region, access_key, secret_key, role_arn, limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching scan history: {str(e)}"
        )

