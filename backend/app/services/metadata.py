from typing import List, Dict, Any
import json
import io
import datetime
from app.services.s3 import S3Service
from app.services.bedrock import BedrockService

# Import text extraction libraries
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

try:
    from pptx import Presentation
except ImportError:
    Presentation = None

class MetadataService:
    def __init__(self):
        self.s3_service = S3Service()
        self.bedrock_service = BedrockService()

    def _extract_text(self, content: bytes, file_ext: str) -> str:
        """Extract text from various file formats"""
        file_ext = file_ext.lower()
        
        if file_ext == 'pdf':
            if not pypdf:
                return "Error: pypdf library not installed"
            try:
                pdf_file = io.BytesIO(content)
                reader = pypdf.PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
            except Exception as e:
                return f"Error extracting PDF text: {str(e)}"

        elif file_ext in ['docx', 'doc']:
            if not docx:
                return "Error: python-docx library not installed"
            try:
                doc_file = io.BytesIO(content)
                doc = docx.Document(doc_file)
                return "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                return f"Error extracting DOCX text: {str(e)}"

        elif file_ext in ['pptx', 'ppt']:
            if not Presentation:
                return "Error: python-pptx library not installed"
            try:
                ppt_file = io.BytesIO(content)
                prs = Presentation(ppt_file)
                text = []
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            text.append(shape.text)
                return "\n".join(text)
            except Exception as e:
                return f"Error extracting PPTX text: {str(e)}"

        else:
            # Assume text for other formats
            try:
                return content.decode('utf-8')
            except UnicodeDecodeError:
                return f"Error: Binary file {file_ext} not supported for text extraction"

    def _log(self, msg: str):
        try:
            with open("C:/Users/soumi/Downloads/DataQuality/backend/debug_absolute.log", "a") as f:
                f.write(f"{datetime.datetime.now()}: {msg}\n")
        except Exception as e:
            print(f"Logging failed: {e}")
        print(msg)

    async def process_files(self, bucket: str, file_keys: List[str], region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None, model_id: str = None) -> List[Dict[str, Any]]:
        self._log(f"Processing {len(file_keys)} files from bucket {bucket}")
        results = []
        file_analyses = []  # Store full analysis for each file
        
        for key in file_keys:
            self._log(f"Starting processing for file: {key}")
            try:
                # Skip folders
                if key.endswith('/'):
                    self._log(f"Skipping folder: {key}")
                    continue

                # Determine file type
                file_ext = key.split('.')[-1] if '.' in key else ''
                self._log(f"File extension: {file_ext}")
                
                # 1. Read file content (binary mode)
                self._log(f"Reading file from S3: {key}")
                content_bytes = await self.s3_service.read_file(bucket, key, region, access_key, secret_key, role_arn, binary=True)
                self._log(f"Read {len(content_bytes)} bytes")
                
                # 2. Extract text
                self._log("Extracting text...")
                text_content = self._extract_text(content_bytes, file_ext)
                self._log(f"Extracted text length: {len(text_content)}")
                
                if not text_content or text_content.startswith("Error:"):
                    error_msg = text_content or "Empty content"
                    self._log(f"Text extraction failed: {error_msg}")
                    results.append({
                        "file_key": key,
                        "status": "error",
                        "error": error_msg
                    })
                    file_analyses.append({
                        "file_key": key,
                        "file_name": key.split('/')[-1],
                        "status": "error",
                        "error": error_msg,
                        "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                    })
                    continue

                # 3. Analyze with Bedrock
                file_name = key.split('/')[-1]
                self._log(f"Analyzing with Bedrock model: {model_id}")
                analysis = self.bedrock_service.analyze_content(
                    content=text_content, 
                    file_name=file_name,
                    model_id=model_id,
                    region=region,
                    access_key=access_key,
                    secret_key=secret_key,
                    role_arn=role_arn
                )
                self._log("Bedrock analysis complete")
                
                # 4. Store analysis as individual JSON file
                file_analysis = {
                    "file_key": key,
                    "file_name": file_name,
                    "status": "success",
                    "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
                    **analysis
                }
                
                # Write individual JSON file
                json_key = f"{key}.json"
                self._log(f"Writing result to S3: {json_key}")
                self.s3_service.write_file(
                    bucket=bucket,
                    key=json_key,
                    content=json.dumps(file_analysis, indent=2),
                    region=region,
                    access_key=access_key,
                    secret_key=secret_key,
                    role_arn=role_arn
                )
                
                file_analyses.append(file_analysis)
                
                results.append({
                    "file_key": key,
                    "status": "success",
                    "summary": analysis.get("summary", "No summary available"),
                    "metadata_key": json_key
                })
                
            except Exception as e:
                self._log(f"Error processing {key}: {str(e)}")
                import traceback
                traceback.print_exc()
                results.append({
                    "file_key": key,
                    "status": "error",
                    "error": str(e)
                })
                file_analyses.append({
                    "file_key": key,
                    "file_name": key.split('/')[-1],
                    "status": "error",
                    "error": str(e),
                    "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                })

        self._log(f"Processing complete. Processed {len(file_analyses)} files.")
        
        # Return results with full analysis data for immediate UI display
        # We attach the full analysis list to the first result so the UI can grab it easily
        # This maintains backward compatibility with the UI we just built
        
        consolidated_json = {
            "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
            "total_files": len(file_keys),
            "successful": len([r for r in results if r["status"] == "success"]),
            "failed": len([r for r in results if r["status"] == "error"]),
            "model_used": model_id,
            "files": file_analyses
        }
        
        # Save consolidated JSON to S3 in output_folder
        timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        consolidated_key = f"output_folder/quality_check_results_{timestamp}.json"
        self._log(f"Saving consolidated results to S3: {consolidated_key}")
        
        try:
            await self.s3_service.write_file(
                bucket=bucket,
                key=consolidated_key,
                content=json.dumps(consolidated_json, indent=2),
                region=region,
                access_key=access_key,
                secret_key=secret_key,
                role_arn=role_arn
            )
            self._log(f"Consolidated results saved successfully to {consolidated_key}")
        except Exception as e:
            self._log(f"Warning: Failed to save consolidated results: {str(e)}")
            
        # Save LOCALLY as requested by user
        try:
            import os
            local_dir = "data/results"
            os.makedirs(local_dir, exist_ok=True)
            local_filename = f"{local_dir}/results_{bucket}_{timestamp}.json"
            with open(local_filename, "w") as f:
                json.dump(consolidated_json, f, indent=2)
            self._log(f"Saved local result copy to {local_filename}")
        except Exception as e:
            self._log(f"Failed to save local result: {str(e)}")
        
        if results:
            results[0]["consolidated_json"] = consolidated_json
            results[0]["consolidated_key"] = consolidated_key
            
        return results

    def list_local_history(self) -> List[Dict[str, Any]]:
        """List all locally saved result files"""
        import os
        import glob
        
        local_dir = "data/results"
        if not os.path.exists(local_dir):
            return []
            
        files = []
        for filepath in glob.glob(f"{local_dir}/*.json"):
            try:
                filename = os.path.basename(filepath)
                stats = os.stat(filepath)
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    
                files.append({
                    "filename": filename,
                    "created_at": datetime.datetime.fromtimestamp(stats.st_mtime).isoformat(),
                    "total_files": data.get("total_files", 0),
                    "successful": data.get("successful", 0),
                    "failed": data.get("failed", 0),
                    "model_used": data.get("model_used", "unknown")
                })
            except Exception as e:
                self._log(f"Error reading local file {filepath}: {str(e)}")
                
        # Sort by creation time (newest first)
        files.sort(key=lambda x: x['created_at'], reverse=True)
        return files

    def get_local_history_content(self, filename: str) -> Dict[str, Any]:
        """Get content of a specific local result file"""
        import os
        local_dir = "data/results"
        filepath = os.path.join(local_dir, filename)
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Local file not found: {filename}")
            
        with open(filepath, 'r') as f:
            return json.load(f)

    async def get_file_content(self, bucket: str, key: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> Dict[str, Any]:
        self._log(f"get_file_content called for bucket={bucket}, key={key}")
        try:
            content_bytes = await self.s3_service.read_file(bucket, key, region, access_key, secret_key, role_arn)
            return json.loads(content_bytes)
        except FileNotFoundError:
            # Auto-reconstruction: If the summary file is missing, try to build it from individual files
            if "quality_check_results" in key:
                self._log(f"Summary file {key} not found. Attempting to reconstruct from individual files...")
                try:
                    # List files in root AND output_folder to be sure we catch everything
                    all_files = []
                    
                    # 1. Check root
                    root_data = await self.s3_service.list_files(bucket, "", region, access_key, secret_key, role_arn)
                    all_files.extend(root_data.get('files', []))
                    
                    # 2. Check output_folder
                    out_data = await self.s3_service.list_files(bucket, "output_folder/", region, access_key, secret_key, role_arn)
                    all_files.extend(out_data.get('files', []))
                    
                    # Filter for individual analysis files
                    json_files = [f for f in all_files if f.get('key', '').endswith('.json') and 
                                  "quality_check_results" not in f.get('key', '') and 
                                  not f.get('is_folder', False)]
                    
                    # Remove duplicates based on key
                    unique_files = {f['key']: f for f in json_files}.values()
                    json_files = list(unique_files)
                    
                    # Sort by most recent
                    json_files.sort(key=lambda x: x.get('last_modified', ''), reverse=True)
                    json_files = json_files[:50]
                    
                    reconstructed_files = []
                    successful = 0
                    failed = 0
                    
                    # Add a DEBUG entry so the user sees SOMETHING
                    reconstructed_files.append({
                        "file_name": "🔍 SYSTEM DIAGNOSTIC",
                        "status": "info",
                        "summary": f"Found {len(json_files)} potential analysis files. Attempting to load...",
                        "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                    })
                    
                    for file_info in json_files:
                        try:
                            content = await self.s3_service.read_file(bucket, file_info['key'], region, access_key, secret_key, role_arn)
                            data = json.loads(content)
                            reconstructed_files.append(data)
                            if data.get('status') == 'success':
                                successful += 1
                            else:
                                failed += 1
                        except Exception as read_err:
                            reconstructed_files.append({
                                "file_name": file_info['key'],
                                "status": "error",
                                "error": f"Failed to read: {str(read_err)}",
                                "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                            })
                            
                    # Construct consolidated response
                    consolidated_data = {
                        "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
                        "total_files": len(reconstructed_files),
                        "successful": successful,
                        "failed": failed,
                        "model_used": "reconstructed",
                        "files": reconstructed_files
                    }
                    
                    self._log("Successfully reconstructed results")
                    return consolidated_data
                    
                except Exception as reconstruct_err:
                    self._log(f"Reconstruction failed: {str(reconstruct_err)}")
                    raise FileNotFoundError(f"File not found: {key} and failed to reconstruct.")
            
            raise
        except Exception as e:
            self._log(f"Error reading file content {key}: {str(e)}")
            raise e
    
    async def reconstruct_results(self, bucket: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> Dict[str, Any]:
        """
        Explicitly reconstruct results by scanning the bucket for all analysis files.
        This is used by the 'Load Past Results' button.
        """
        self._log(f"reconstruct_results called for bucket={bucket}")
        try:
            # List files in root AND output_folder
            all_files = []
            
            # 1. Check root
            root_data = await self.s3_service.list_files(bucket, "", region, access_key, secret_key, role_arn)
            all_files.extend(root_data.get('files', []))
            
            # 2. Check output_folder
            out_data = await self.s3_service.list_files(bucket, "output_folder/", region, access_key, secret_key, role_arn)
            all_files.extend(out_data.get('files', []))
            
            # Filter for individual analysis files
            json_files = [f for f in all_files if f.get('key', '').endswith('.json') and 
                          "quality_check_results" not in f.get('key', '') and 
                          not f.get('is_folder', False)]
            
            # Remove duplicates
            unique_files = {f['key']: f for f in json_files}.values()
            json_files = list(unique_files)
            
            # Sort by most recent
            json_files.sort(key=lambda x: x.get('last_modified', ''), reverse=True)
            json_files = json_files[:50]
            
            reconstructed_files = []
            successful = 0
            failed = 0
            
            for file_info in json_files:
                try:
                    content = await self.s3_service.read_file(bucket, file_info['key'], region, access_key, secret_key, role_arn)
                    data = json.loads(content)
                    reconstructed_files.append(data)
                    if data.get('status') == 'success':
                        successful += 1
                    else:
                        failed += 1
                except Exception as read_err:
                    reconstructed_files.append({
                        "file_name": file_info['key'],
                        "status": "error",
                        "error": f"Failed to read: {str(read_err)}",
                        "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                    })
            
            if not reconstructed_files:
                # Return empty structure instead of error
                return {
                    "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
                    "total_files": 0,
                    "successful": 0,
                    "failed": 0,
                    "model_used": "none",
                    "files": [],
                    "note": "No analysis files found in bucket."
                }
                
            return {
                "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
                "total_files": len(reconstructed_files),
                "successful": successful,
                "failed": failed,
                "model_used": "reconstructed",
                "files": reconstructed_files,
                "note": "Loaded from history"
            }
            
        except Exception as e:
            self._log(f"Error reconstructing results: {str(e)}")
            raise e

    async def get_scan_history(self, bucket: str, prefix: str = "", region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch recent scan history by reading .json result files from S3
        Returns aggregated scan data for dashboard visualization
        """
        self._log(f"get_scan_history called for bucket={bucket}, prefix={prefix}")
        try:
            # List all files in the bucket
            files_data = await self.s3_service.list_files(bucket, prefix, region, access_key, secret_key, role_arn)
            files = files_data.get('files', [])
            
            # Filter for .json files (our scan results)
            json_files = [f for f in files if f.get('key', '').endswith('.json') and not f.get('is_folder', False)]
            
            # Sort by last_modified (most recent first)
            json_files.sort(key=lambda x: x.get('last_modified', ''), reverse=True)
            
            # Limit to requested number
            json_files = json_files[:limit]
            
            # Fetch content of each JSON file
            scan_results = []
            for file_info in json_files:
                try:
                    content = await self.get_file_content(bucket, file_info['key'], region, access_key, secret_key, role_arn)
                    
                    # Extract relevant information
                    scan_entry = {
                        'file_key': file_info['key'],
                        'file_name': content.get('file_name', file_info['key']),
                        'processed_at': content.get('processed_at', file_info.get('last_modified', '')),
                        'quality_score': content.get('quality_score', 0),
                        'status': content.get('status', 'unknown'),
                        'summary': content.get('summary', ''),
                        'source_file': content.get('file_key', '').replace('.json', ''),
                    }
                    scan_results.append(scan_entry)
                except Exception as e:
                    self._log(f"Error reading scan result {file_info['key']}: {str(e)}")
                    continue
            
            # Calculate aggregate statistics
            total_scans = len(scan_results)
            successful_scans = len([s for s in scan_results if s['status'] == 'success'])
            avg_quality = sum(s['quality_score'] for s in scan_results) / total_scans if total_scans > 0 else 0
            
            return {
                'scans': scan_results,
                'total_scans': total_scans,
                'successful_scans': successful_scans,
                'failed_scans': total_scans - successful_scans,
                'average_quality_score': round(avg_quality, 1)
            }
            
        except Exception as e:
            self._log(f"Error fetching scan history: {str(e)}")
            raise e
