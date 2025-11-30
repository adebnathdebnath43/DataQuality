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
        
        if results:
            results[0]["consolidated_json"] = consolidated_json
            
        return results

    async def get_file_content(self, bucket: str, key: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> Dict[str, Any]:
        self._log(f"get_file_content called for bucket={bucket}, key={key}")
        try:
            content_bytes = await self.s3_service.read_file(bucket, key, region, access_key, secret_key, role_arn)
            return json.loads(content_bytes)
        except Exception as e:
            self._log(f"Error reading file content {key}: {str(e)}")
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
