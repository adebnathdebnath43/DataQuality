from fastapi import APIRouter, HTTPException, status, Request
from app.models.schemas import (
    ExtractMetadataRequest,
    ExtractMetadataResponse,
    FileProcessingResult,
    HealthResponse
)
from app.services.metadata import MetadataService
from app.services.s3 import S3Service
from app.services.bedrock import BedrockService
import glob
import json
import datetime

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

@router.post("/reanalyze-dimension")
async def reanalyze_dimension(request: Request):
    """Re-analyze a single dimension with user feedback"""
    try:
        data = await request.json()
        file_name = data.get("file_name")
        dimension_name = data.get("dimension_name")
        feedback = data.get("feedback", "")
        bucket = data.get("bucket")
        region = data.get("region")
        access_key = data.get("access_key")
        secret_key = data.get("secret_key")
        model_id = data.get("model_id")
        
        if not all([file_name, dimension_name, bucket, region, access_key, secret_key, model_id]):
            raise HTTPException(status_code=400, detail="Missing required parameters")
        
        # Find the result file to get file_key
        results_dir = "C:/Users/soumi/Downloads/DataQuality/backend/data/results"
        result_file = None
        file_key = None
        file_data_ref = None
        
        for filepath in glob.glob(f"{results_dir}/*.json"):
            with open(filepath, 'r', encoding='utf-8') as f:
                result_data = json.load(f)
                for file_data in result_data.get("files", []):
                    if file_data.get("file_name") == file_name:
                        result_file = filepath
                        file_key = file_data.get("file_key")
                        file_data_ref = file_data
                        break
                if result_file:
                    break
        
        if not result_file or not file_key:
            raise HTTPException(status_code=404, detail="File not found in results")
        
        # Get file content from S3
        s3_service = S3Service()
        # Read raw bytes for text extraction
        file_content = await s3_service.read_file(
            bucket=bucket,
            key=file_key,
            region=region,
            access_key=access_key,
            secret_key=secret_key,
            binary=True
        )
        
        # Extract text from the file
        metadata_service = MetadataService()
        file_ext = file_key.split('.')[-1] if '.' in file_key else 'txt'
        extracted_text = metadata_service._extract_text(file_content, file_ext)
        
        # Build focused prompt for this specific dimension using the strict scoring rubric
        # Get the dimension definition from the master prompt
        dimension_definitions = {
            "accuracy": "1. Accuracy (Data correctly represents reality)\n   Real failure: Cap table showed founder with 95% instead of 9.5% → $40M valuation mistake\n   100 = All facts, dates, numbers, entities provably correct\n   70 = One minor typo that doesn't change meaning\n   30 = Impossible date (Feb 30) or wrong amount\n   0 = Multiple critical factual errors",
            "completeness": "2. Completeness (Nothing required is missing)\n   Real failure: SPA missing pages 78–115 (all schedules) → RAG said \"no reps\"\n   100 = All pages, exhibits, tables, signatures present\n   0 = Large sections or entire document missing",
            "consistency": "3. Consistency (Uniform representation, no contradictions)\n   Real failure: Same company called \"Target\" in first half, \"Company\" in second\n   100 = Entity names, date/number formats, terminology identical throughout\n   0 = Contradictory clauses or wildly inconsistent formatting",
            "timeliness": "4. Timeliness (Current and not superseded)\n   Real failure: Model quoted expired draft term sheet named \"v12_draft.docx\"\n   100 = Clearly the final/executed/latest version\n   50 = Old draft with no clear execution date\n   0 = Known to be superseded",
            "validity": "5. Validity (Conforms to rules and formats)\n   Real failure: Dates in format 13/15/2024 or phone numbers with letters\n   100 = All dates, currencies, IDs, structures follow standards\n   0 = Multiple malformed fields",
            "uniqueness": "6. Uniqueness (No duplicates or near-duplicates)\n   Real failure: 8 almost-identical NDA drafts polluted training data\n   100 = Clearly unique or meaningfully different version\n   0 = Byte-for-byte or near-identical copy already in corpus",
            "reliability": "7. Reliability (Source and process are trustworthy)\n   Real failure: Data from unverified third-party scraper\n   100 = Official source (law firm, SEC filing, signed PDF)\n   0 = Unknown origin, screenshot from WhatsApp",
            "relevance": "8. Relevance (Useful for the intended business purpose)\n   Real failure: Data room contained birthday cards and cat memes\n   100 = Directly relevant (contract, financials, board minutes)\n   0 = Completely off-topic personal content",
            "accessibility": "9. Accessibility (Can be retrieved and parsed easily)\n   Real failure: Password-protected ZIP of 400 contracts\n   100 = No password, renders perfectly, text selectable\n   0 = Encrypted, corrupted, or unparseable",
            "precision": "10. Precision (Right level of granularity)\n    Real failure: Financials rounded to nearest million when cents matter\n    100 = Numbers have required decimal places (e.g., $12,345,678.90)\n    0 = Excessive or insufficient precision",
            "integrity": "11. Integrity (Relationships and constraints preserved)\n    Real failure: Cap table percentages sum to 101.3%\n    100 = Totals add up, references correct\n    0 = Broken referential integrity",
            "conformity": "12. Conformity (Follows organizational/industry standards)\n    Real failure: Contract missing required boilerplate clauses\n    100 = Matches expected template/structure\n    0 = Deviates heavily from standard",
            "interpretability": "13. Interpretability (Meaning is clear)\n    Real failure: Hundreds of undefined acronyms\n    100 = Clear language, defined terms, good metadata\n    0 = Heavy jargon with no glossary",
            "traceability": "14. Traceability (Clear origin and version history)\n    Real failure: File named \"FINAL_Final_v2_REALLYFINAL.docx\"\n    100 = Clear filename, version, author, date\n    0 = No provenance whatsoever",
            "credibility": "15. Credibility (Believable and from reputable source)\n    Real failure: \"Financials\" from anonymous Google Drive link\n    100 = Signed by Big-4 auditor or law firm\n    0 = Obvious forgery or joke document",
            "fitness_for_use": "16. Fitness_for_Use (Actually usable for target AI/business tasks)\n    Real failure: 120-slide deck with 110 blank/logo slides\n    100 = High signal-to-noise, dense useful content\n    0 = Pure fluff or placeholders",
            "value": "17. Value (Business benefit vs. risk/cost of ingestion)\n    Real failure: Toxic internal email thread that poisoned fine-tuned model\n    100 = High ROI, low risk\n    0 = High risk of bias, toxicity, PII, or legal exposure"
        }
        
        dim_key = dimension_name.lower().replace(" ", "_")
        dimension_def = dimension_definitions.get(dim_key, f"{dimension_name} dimension")
        
        # Truncate content to avoid overwhelming the LLM
        content_preview = extracted_text[:4000] if len(extracted_text) > 4000 else extracted_text
        
        focused_prompt = f"""You are a rigorous Enterprise Data Quality Agent re-evaluating a SINGLE dimension.

USER REJECTION & FEEDBACK:
The user rejected the previous assessment of '{dimension_name}' with this feedback:
"{feedback}"

YOUR TASK:
Re-evaluate ONLY the '{dimension_name}' dimension using the scoring rubric below and considering the user's feedback.

{dimension_def}

DOCUMENT TO RE-ANALYZE:
File: {file_name}
Type: {file_name.split('.')[-1].upper() if '.' in file_name else 'UNKNOWN'}

Content:
{content_preview}

OUTPUT FORMAT - Return ONLY valid JSON, no markdown, no extra text:
{{
  "{dimension_name}": {{
    "score": 75,
    "evidence": "Specific evidence from the document addressing the user's feedback"
  }}
}}"""
        
        # Call Bedrock directly with focused prompt
        bedrock_service = BedrockService(region_name=region)
        
        # Invoke model directly with the focused prompt
        client = bedrock_service._get_client(region, access_key, secret_key)
        
        # Prepare request based on model type
        if 'anthropic' in model_id.lower() or 'claude' in model_id.lower():
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "temperature": 0.3,
                "messages": [{"role": "user", "content": focused_prompt}]
            })
        elif 'mistral' in model_id.lower():
            body = json.dumps({
                "prompt": f"<s>[INST] {focused_prompt} [/INST]",
                "max_tokens": 2000,
                "temperature": 0.3
            })
        else:
            # Generic format
            body = json.dumps({
                "prompt": focused_prompt,
                "max_tokens": 2000,
                "temperature": 0.3
            })
        
        print(f"\n=== RE-ANALYSIS REQUEST ===")
        print(f"Model: {model_id}")
        print(f"Dimension: {dimension_name}")
        print(f"Feedback: {feedback}")
        print(f"Content length: {len(extracted_text)} chars")
        
        response = client.invoke_model(modelId=model_id, body=body)
        response_body = json.loads(response['body'].read())
        
        # Extract result based on model type
        if 'anthropic' in model_id.lower() or 'claude' in model_id.lower():
            result_text = response_body['content'][0]['text']
        elif 'mistral' in model_id.lower():
            result_text = response_body['outputs'][0]['text']
        else:
            result_text = response_body.get('completion', response_body.get('text', ''))
        
        print(f"\n=== BEDROCK RAW RESPONSE ===")
        print(f"Response length: {len(result_text)} chars")
        print(f"First 500 chars: {result_text[:500]}")
        print(f"Last 200 chars: {result_text[-200:]}")
        print(f"=== END RAW RESPONSE ===\n")
        print(f"\n=== BEDROCK RAW RESPONSE ===")
        print(f"Response length: {len(result_text)} chars")
        print(f"First 500 chars: {result_text[:500]}")
        print(f"Last 200 chars: {result_text[-200:]}")
        print(f"=== END RAW RESPONSE ===\n")
        
        # Parse JSON from response with robust error handling
        try:
            # Clean the response text
            json_str = result_text.strip()
            
            # Remove markdown code blocks if present
            if '```json' in json_str:
                start = json_str.find('```json') + 7
                end = json_str.find('```', start)
                if end == -1:
                    end = len(json_str)
                json_str = json_str[start:end].strip()
            elif '```' in json_str:
                start = json_str.find('```') + 3
                end = json_str.find('```', start)
                if end == -1:
                    end = len(json_str)
                json_str = json_str[start:end].strip()
            
            # Find JSON object boundaries if not at start
            if json_str and json_str[0] != '{':
                start_idx = json_str.find('{')
                if start_idx != -1:
                    end_idx = json_str.rfind('}') + 1
                    if end_idx > start_idx:
                        json_str = json_str[start_idx:end_idx]
            
            # Remove any trailing text after the closing brace
            if json_str and '}' in json_str:
                last_brace = json_str.rfind('}')
                json_str = json_str[:last_brace + 1]
            
            print(f"Cleaned JSON string (first 300 chars): {json_str[:300]}")
            
            # Parse the JSON
            parsed = json.loads(json_str)
            print(f"Successfully parsed JSON with keys: {list(parsed.keys())}")
            
            # Extract dimension result with multiple strategies
            dimension_result = None
            
            # Strategy 1: Exact dimension name match
            if dimension_name in parsed:
                dimension_result = parsed[dimension_name]
                print(f"✓ Found via exact match: {dimension_name}")
            
            # Strategy 2: Normalized key match
            elif dim_key in parsed:
                dimension_result = parsed[dim_key]
                print(f"✓ Found via normalized key: {dim_key}")
            
            # Strategy 3: Case-insensitive search
            else:
                for key, value in parsed.items():
                    if isinstance(value, dict) and 'score' in value:
                        key_lower = key.lower().replace(" ", "_").replace("-", "_")
                        dim_lower = dimension_name.lower().replace(" ", "_").replace("-", "_")
                        if key_lower == dim_lower:
                            dimension_result = value
                            print(f"✓ Found via case-insensitive match: {key}")
                            break
            
            # Strategy 4: Direct dimension object (response is {score, evidence})
            if not dimension_result and 'score' in parsed and 'evidence' in parsed:
                dimension_result = parsed
                print(f"✓ Response is direct dimension object")
            
            # Strategy 5: First dict with score and evidence
            if not dimension_result:
                for key, value in parsed.items():
                    if isinstance(value, dict) and 'score' in value and 'evidence' in value:
                        dimension_result = value
                        print(f"✓ Found dimension object under key: {key}")
                        break
            
            if not dimension_result:
                raise ValueError(f"No dimension data found in response. Available keys: {list(parsed.keys())}")
            
            # Validate the dimension result has required fields
            if not isinstance(dimension_result, dict):
                raise ValueError(f"Dimension result is not a dict: {type(dimension_result)}")
            
            if 'score' not in dimension_result:
                raise ValueError(f"Dimension result missing 'score' field. Keys: {list(dimension_result.keys())}")
            
            if 'evidence' not in dimension_result:
                dimension_result['evidence'] = f"Re-analyzed based on feedback: {feedback}"
            
            print(f"✓ Final dimension result - Score: {dimension_result['score']}, Evidence length: {len(str(dimension_result['evidence']))} chars")
                
        except json.JSONDecodeError as json_error:
            print(f"❌ JSON decode error: {str(json_error)}")
            print(f"Attempted to parse: {json_str[:500] if 'json_str' in locals() else result_text[:500]}")
            dimension_result = {
                "score": 50,
                "evidence": f"Re-analysis JSON parsing failed: {str(json_error)}. User feedback: {feedback}. Please check backend logs for full response."
            }
        except Exception as parse_error:
            print(f"❌ General parsing error: {str(parse_error)}")
            print(f"Error type: {type(parse_error).__name__}")
            dimension_result = {
                "score": 50,
                "evidence": f"Re-analysis failed: {str(parse_error)}. User feedback: {feedback}. Check backend logs for details."
            }
        
        # Update the result file with new dimension score
        with open(result_file, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
        
        for file_data in result_data.get("files", []):
            if file_data.get("file_name") == file_name:
                # Initialize dimension_approvals if not exists
                if "dimension_approvals" not in file_data:
                    file_data["dimension_approvals"] = {}
                
                # Store re-analysis history
                if dimension_name not in file_data["dimension_approvals"]:
                    file_data["dimension_approvals"][dimension_name] = {}
                
                if "history" not in file_data["dimension_approvals"][dimension_name]:
                    file_data["dimension_approvals"][dimension_name]["history"] = []
                
                # Add current state to history before updating
                current_dim = file_data.get("dimensions", {}).get(dimension_name, {})
                file_data["dimension_approvals"][dimension_name]["history"].append({
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "action": "reanalyzed",
                    "feedback": feedback,
                    "old_score": current_dim.get("score", 0),
                    "old_evidence": current_dim.get("evidence", ""),
                    "new_score": dimension_result.get("score", 0),
                    "new_evidence": dimension_result.get("evidence", "")
                })
                
                # Update dimension score and evidence
                if "dimensions" not in file_data:
                    file_data["dimensions"] = {}
                
                file_data["dimensions"][dimension_name] = {
                    "score": dimension_result.get("score", 0),
                    "evidence": dimension_result.get("evidence", "")
                }
                
                # Update status to reanalyzed
                file_data["dimension_approvals"][dimension_name]["status"] = "reanalyzed"
                file_data["dimension_approvals"][dimension_name]["feedback"] = feedback
                file_data["dimension_approvals"][dimension_name]["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                
                # Recalculate overall score
                if file_data.get("dimensions"):
                    scores = [d.get("score", 0) for d in file_data["dimensions"].values() if isinstance(d, dict)]
                    if scores:
                        file_data["overall_quality_score"] = sum(scores) / len(scores)
                
                break
        
        # Save updated data
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2)
        
        return {
            "status": "success",
            "dimension": dimension_name,
            "new_score": dimension_result.get("score", 0),
            "new_evidence": dimension_result.get("evidence", ""),
            "overall_score": file_data.get("overall_quality_score", 0)
        }
    
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
