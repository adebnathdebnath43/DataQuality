from fastapi import APIRouter, HTTPException, status, Request
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

@router.get("/dashboard-metrics")
async def get_dashboard_metrics():
    """
    Get aggregated metrics for dashboard
    Returns last 7 days of quality check trends, dimension scores, file details, etc.
    """
    try:
        import glob
        import datetime
        import json
        from collections import defaultdict
        
        # Get all local result files from last 7 days
        results_dir = "C:/Users/soumi/Downloads/DataQuality/backend/data/results"
        seven_days_ago = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)
        
        all_files = []
        daily_stats = defaultdict(lambda: {"count": 0, "avg_quality": 0, "total_quality": 0})
        dimension_totals = defaultdict(int)
        dimension_counts = defaultdict(int)
        bucket_name = None
        
        # Read all result files
        for filepath in glob.glob(f"{results_dir}/*.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Extract bucket name from first file
                if not bucket_name and data.get("files"):
                    file_key = data["files"][0].get("file_key", "")
                    if "s3://" in file_key:
                        bucket_name = file_key.split("/")[2]
                    
                # Check if file is from last 7 days
                processed_at = data.get("processed_at", "")
                if processed_at:
                    # Parse file date (UTC)
                    file_date = datetime.datetime.fromisoformat(processed_at.replace('Z', '+00:00'))
                    
                    # Ensure seven_days_ago is timezone-aware (UTC)
                    if seven_days_ago.tzinfo is None:
                        seven_days_ago = seven_days_ago.replace(tzinfo=datetime.timezone.utc)
                    
                    # Debug logging
                    print(f"[DEBUG] File: {filepath}, Date: {file_date}, 7 Days Ago: {seven_days_ago}")
                    
                    if file_date >= seven_days_ago:
                        day_key = file_date.strftime("%Y-%m-%d")
                        
                        # Aggregate daily stats
                        for file_data in data.get("files", []):
                            if file_data.get("status") == "success":
                                daily_stats[day_key]["count"] += 1
                                quality = file_data.get("overall_quality_score") or file_data.get("quality_score", 0)
                                daily_stats[day_key]["total_quality"] += quality
                                
                                # Aggregate dimension scores
                                if "dimensions" in file_data:
                                    for dim_name, dim_data in file_data["dimensions"].items():
                                        dimension_totals[dim_name] += dim_data.get("score", 0)
                                        dimension_counts[dim_name] += 1
                                
                                all_files.append({
                                    "file_name": file_data.get("file_name"),
                                    "file_key": file_data.get("file_key", ""),
                                    "quality_score": quality,
                                    "processed_at": processed_at,
                                    "recommended_action": file_data.get("recommended_action", "REVIEW"),
                                    "dimensions": file_data.get("dimensions", {})
                                })
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
                continue
        
        # Calculate averages
        for day in daily_stats:
            if daily_stats[day]["count"] > 0:
                daily_stats[day]["avg_quality"] = round(daily_stats[day]["total_quality"] / daily_stats[day]["count"])
        
        # Calculate average dimension scores
        avg_dimensions = {}
        for dim_name in dimension_totals:
            if dimension_counts[dim_name] > 0:
                avg_dimensions[dim_name] = round(dimension_totals[dim_name] / dimension_counts[dim_name])
        
        # Sort daily stats by date
        sorted_daily = sorted(daily_stats.items(), key=lambda x: x[0])
        
        return {
            "last_7_days": [
                {
                    "date": day,
                    "files_processed": stats["count"],
                    "avg_quality_score": stats["avg_quality"]
                }
                for day, stats in sorted_daily
            ],
            "total_files_processed": sum(s["count"] for s in daily_stats.values()),
            "avg_dimension_scores": avg_dimensions,
            "recent_files": sorted(all_files, key=lambda x: x["processed_at"], reverse=True)[:20],
            "bucket_name": bucket_name or "N/A"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve-dimension")
async def approve_dimension(request: Request):
    """Approve a specific dimension for a file"""
    try:
        data = await request.json()
        file_name = data.get("file_name")
        dimension_name = data.get("dimension_name")
        
        if not file_name or not dimension_name:
            raise HTTPException(status_code=400, detail="file_name and dimension_name required")
        
        # Find the result file
        results_dir = "C:/Users/soumi/Downloads/DataQuality/backend/data/results"
        result_file = None
        
        for filepath in glob.glob(f"{results_dir}/*.json"):
            with open(filepath, 'r', encoding='utf-8') as f:
                result_data = json.load(f)
                for file_data in result_data.get("files", []):
                    if file_data.get("file_name") == file_name:
                        result_file = filepath
                        break
                if result_file:
                    break
        
        if not result_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Update the dimension approval status
        with open(result_file, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
        
        for file_data in result_data.get("files", []):
            if file_data.get("file_name") == file_name:
                if "dimension_approvals" not in file_data:
                    file_data["dimension_approvals"] = {}
                file_data["dimension_approvals"][dimension_name] = {
                    "status": "approved",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                break
        
        # Save updated data
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2)
        
        return {"status": "success", "message": f"Dimension {dimension_name} approved"}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-dimension")
async def reject_dimension(request: Request):
    """Reject a specific dimension with feedback for re-analysis"""
    try:
        data = await request.json()
        file_name = data.get("file_name")
        dimension_name = data.get("dimension_name")
        feedback = data.get("feedback", "")
        
        if not file_name or not dimension_name:
            raise HTTPException(status_code=400, detail="file_name and dimension_name required")
        
        # Find the result file
        results_dir = "C:/Users/soumi/Downloads/DataQuality/backend/data/results"
        result_file = None
        
        for filepath in glob.glob(f"{results_dir}/*.json"):
            with open(filepath, 'r', encoding='utf-8') as f:
                result_data = json.load(f)
                for file_data in result_data.get("files", []):
                    if file_data.get("file_name") == file_name:
                        result_file = filepath
                        break
                if result_file:
                    break
        
        if not result_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Update the dimension rejection status
        with open(result_file, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
        
        for file_data in result_data.get("files", []):
            if file_data.get("file_name") == file_name:
                if "dimension_approvals" not in file_data:
                    file_data["dimension_approvals"] = {}
                file_data["dimension_approvals"][dimension_name] = {
                    "status": "rejected",
                    "feedback": feedback,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                break
        
        # Save updated data
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2)
        
        return {"status": "success", "message": f"Dimension {dimension_name} rejected", "feedback": feedback}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reanalyze-file")
async def reanalyze_file(request: Request):
    """Re-analyze a file with dimension-specific feedback"""
    try:
        data = await request.json()
        file_key = data.get("file_key")
        bucket = data.get("bucket")
        region = data.get("region")
        access_key = data.get("access_key")
        secret_key = data.get("secret_key")
        model_id = data.get("model_id")
        dimension_feedback = data.get("dimension_feedback", {})  # Dict of {dimension_name: feedback}
        
        if not all([file_key, bucket, region, access_key, secret_key, model_id]):
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        # Initialize services
        s3_service = S3Service()
        bedrock_service = BedrockService(region_name=region)
        metadata_service = MetadataService(s3_service, bedrock_service)
        
        # Build enhanced prompt with feedback
        feedback_prompt = ""
        if dimension_feedback:
            feedback_prompt = "\n\n=== USER FEEDBACK ON PREVIOUS ANALYSIS ===\n"
            for dim_name, feedback in dimension_feedback.items():
                feedback_prompt += f"\n{dim_name}: {feedback}"
            feedback_prompt += "\n\nPlease re-evaluate these dimensions considering the feedback above.\n"
        
        # Re-analyze the file
        result = await metadata_service.analyze_file(
            file_key=file_key,
            bucket=bucket,
            region=region,
            access_key=access_key,
            secret_key=secret_key,
            model_id=model_id,
            additional_prompt=feedback_prompt
        )
        
        return result
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
