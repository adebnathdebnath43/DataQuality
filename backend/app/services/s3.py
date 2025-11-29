import boto3
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple
from app.config import settings


class S3Service:
    """Service for S3 operations"""
    
    def __init__(self):
        self.metadata_prefix = settings.s3_metadata_prefix
        self._clients = {}
    
    def _get_client(self, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None):
        """Get or create S3 client for region"""
        region = region or settings.aws_region
        
        # If credentials are provided, don't cache the client
        if access_key and secret_key:
            return boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
            
        # If role_arn is provided, assume role
        if role_arn:
            try:
                # Use provided credentials to create STS client if available
                if access_key and secret_key:
                    sts_client = boto3.client(
                        'sts', 
                        region_name=region,
                        aws_access_key_id=access_key,
                        aws_secret_access_key=secret_key
                    )
                else:
                    sts_client = boto3.client('sts', region_name=region)
                    
                assumed_role = sts_client.assume_role(
                    RoleArn=role_arn,
                    RoleSessionName='AetherDataQualitySession'
                )
                credentials = assumed_role['Credentials']
                return boto3.client(
                    's3',
                    region_name=region,
                    aws_access_key_id=credentials['AccessKeyId'],
                    aws_secret_access_key=credentials['SecretAccessKey'],
                    aws_session_token=credentials['SessionToken']
                )
            except Exception as e:
                print(f"Error assuming role {role_arn}: {str(e)}")
                raise

        if region not in self._clients:
            self._clients[region] = boto3.client('s3', region_name=region)
        return self._clients[region]
    
    async def read_file(self, bucket: str, key: str, region: str = None) -> Tuple[str, str]:
        """Read file content from S3"""
        try:
            client = self._get_client(region)
            response = client.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read()
            
            # Determine file type
            file_type = self._get_file_type(key)
            
            # Decode content based on type
            if file_type in ['CSV', 'JSON', 'TXT', 'SQL', 'LOG', 'MD', 'HTML', 'XML', 'YAML']:
                try:
                    content_str = content.decode('utf-8')
                except UnicodeDecodeError:
                    content_str = content.decode('latin-1')
            else:
                # For binary files, convert to string representation or skip
                content_str = f"Binary file ({file_type}): {len(content)} bytes"
            
            return content_str, file_type
            
        except Exception as e:
            print(f"Error reading S3 file {bucket}/{key}: {str(e)}")
            raise
    
    async def write_metadata(self, bucket: str, original_key: str, metadata: Dict[str, Any], region: str = None) -> str:
        """Write metadata JSON to S3"""
        try:
            client = self._get_client(region)
            # Create Iceberg-like partitioned path
            now = datetime.utcnow()
            year = now.strftime("%Y")
            month = now.strftime("%m")
            day = now.strftime("%d")
            
            # Generate metadata file name
            file_name = original_key.replace('/', '_').replace('.', '_')
            metadata_key = f"{self.metadata_prefix}year={year}/month={month}/day={day}/{file_name}_metadata.json"
            
            # Add timestamp and source info to metadata
            enriched_metadata = {
                **metadata,
                "source_file": original_key,
                "source_bucket": bucket,
                "extraction_timestamp": now.isoformat(),
                "partition": {
                    "year": year,
                    "month": month,
                    "day": day
                }
            }
            
            # Write to S3
            client.put_object(
                Bucket=bucket,
                Key=metadata_key,
                Body=json.dumps(enriched_metadata, indent=2),
                ContentType='application/json'
            )
            
            return metadata_key
            
        except Exception as e:
            print(f"Error writing metadata to S3: {str(e)}")
            raise

    async def list_files(self, bucket: str, prefix: str = "", region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> List[Dict[str, Any]]:
        client = self._get_client(region, access_key, secret_key, role_arn)
        
        try:
            response = client.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter='/')
            
            files = []
            
            # Add folders
            for p in response.get('CommonPrefixes', []):
                files.append({
                    "name": p['Prefix'].replace(prefix, '').strip('/'),
                    "key": p['Prefix'],
                    "is_folder": True,
                    "size": "-",
                    "type": "Folder",
                    "last_modified": "-"
                })
                
            # Add files
            for obj in response.get('Contents', []):
                if obj['Key'] == prefix:
                    continue
                    
                files.append({
                    "name": obj['Key'].replace(prefix, ''),
                    "key": obj['Key'],
                    "is_folder": False,
                    "size": obj['Size'],
                    "type": self._get_file_type(obj['Key']),
                    "last_modified": obj['LastModified'].isoformat()
                })
                
            return files
            
        except Exception as e:
            print(f"Error listing S3 objects: {str(e)}")
            raise e

    async def read_file(self, bucket: str, key: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> str:
        client = self._get_client(region, access_key, secret_key, role_arn)
        try:
            response = client.get_object(Bucket=bucket, Key=key)
            content = response['Body'].read().decode('utf-8')
            return content
        except Exception as e:
            print(f"Error reading file {key}: {str(e)}")
            raise e

    async def write_file(self, bucket: str, key: str, content: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> str:
        client = self._get_client(region, access_key, secret_key, role_arn)
        try:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=content.encode('utf-8'),
                ContentType='application/json'
            )
            return key
        except Exception as e:
            print(f"Error writing file {key}: {str(e)}")
            raise e

    
    def _get_file_type(self, key: str) -> str:
        """Determine file type from key"""
        extension = key.split('.')[-1].upper() if '.' in key else 'UNKNOWN'
        
        type_mapping = {
            'CSV': 'CSV',
            'JSON': 'JSON',
            'PARQUET': 'PARQUET',
            'TXT': 'TXT',
            'LOG': 'LOG',
            'SQL': 'SQL',
            'XML': 'XML',
            'YAML': 'YAML',
            'YML': 'YAML',
            'PDF': 'PDF',
            'DOCX': 'DOCX',
            'DOC': 'DOC',
            'PPTX': 'PPTX',
            'PPT': 'PPT',
            'XLSX': 'XLSX',
            'XLS': 'XLS',
            'MD': 'MARKDOWN',
            'HTML': 'HTML',
            'HTM': 'HTML'
        }
        
        return type_mapping.get(extension, extension)
