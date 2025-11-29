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
                
                # 4. Create JSON structure
                metadata_doc = {
                    "source_file": key,
                    "analysis": analysis,
                    "processed_at": datetime.datetime.utcnow().isoformat() + "Z"
                }
                
                # 5. Write JSON to S3
                json_key = f"{key}.json"
                self._log(f"Writing result to S3: {json_key}")
                await self.s3_service.write_file(
                    bucket=bucket,
                    key=json_key,
                    content=json.dumps(metadata_doc, indent=2),
                    region=region,
                    access_key=access_key,
                    secret_key=secret_key,
                    role_arn=role_arn
                )
                self._log("Write complete")
                
                results.append({
                    "file_key": key,
                    "status": "success",
                    "metadata_key": json_key,
                    "summary": analysis.get("summary", "No summary available")
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
        return results

    async def get_metadata(self, bucket: str, file_key: str) -> Dict[str, Any]:
        # Placeholder
        raise NotImplementedError("Metadata retrieval not implemented")
