import boto3
import json
from typing import Dict, Any, Optional, List
from app.config import settings

class BedrockService:
    def __init__(self, region_name: str = None):
        self.region_name = region_name or settings.aws_region
        # Default client for environment credentials
        self._default_client = boto3.client('bedrock-runtime', region_name=self.region_name)
        # FALLBACK ONLY: This is only used if no model_id is passed from UI (which should never happen)
        # The actual model_id comes from the UI dropdown selection
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"

    def _get_client(self, region: str = None, access_key: str  = None, secret_key: str = None, role_arn: str = None):
        """
        Get or create Bedrock client.
        
        IMPORTANT: access_key and secret_key are passed from the S3 connection that the user
        configured in the UI. These are the SAME credentials used for S3 access.
        """
        region = region or self.region_name
        
        # Use credentials from S3 connection if provided
        if access_key and secret_key:
            return boto3.client(
                'bedrock-runtime',
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
            
        # If role_arn is provided (with or without keys)
        if role_arn:
            # Logic to assume role would go here, similar to S3Service
            # For now, we'll assume if role is passed, we might need to use it
            # But Bedrock might not be accessible via the assumed role if the role doesn't have Bedrock permissions
            # We'll skip complex assume_role logic for Bedrock for now and fallback to default or keys
            pass

        return self._default_client

    def list_models(self, region: str = None, access_key: str = None, secret_key: str = None) -> List[Dict[str, str]]:
        """List available Bedrock foundation models"""
        # Create bedrock client (not bedrock-runtime)
        region = region or self.region_name
        
        if access_key and secret_key:
            client = boto3.client(
                'bedrock',
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
        else:
            client = boto3.client('bedrock', region_name=region)
        
        try:
            response = client.list_foundation_models()
            models = []
            
            for model in response.get('modelSummaries', []):
                # Filter for text generation models
                if 'TEXT' in model.get('outputModalities', []):
                    models.append({
                        'model_id': model['modelId'],
                        'model_name': model['modelName'],
                        'provider': model['providerName']
                    })
            
            return models
        except Exception as e:
            print(f"Error listing Bedrock models: {str(e)}")
            # Return default models if API fails
            return [
                {
                    'model_id': 'anthropic.claude-3-sonnet-20240229-v1:0',
                    'model_name': 'Claude 3 Sonnet',
                    'provider': 'Anthropic'
                },
                {
                    'model_id': 'anthropic.claude-3-haiku-20240307-v1:0',
                    'model_name': 'Claude 3 Haiku',
                    'provider': 'Anthropic'
                },
                {
                    'model_id': 'mistral.mistral-large-2402-v1:0',
                    'model_name': 'Mistral Large',
                    'provider': 'Mistral AI'
                }
            ]

    def analyze_content(self, content: str, file_name: str, model_id: str = None, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> Dict[str, Any]:
        """
        Analyze file content using Bedrock to extract metadata, summary, and context.
        
        Args:
            model_id: The Bedrock model ID selected by the user from the UI dropdown.
                     This is ALWAYS passed from the UI selection (e.g., 'mistral.mistral-large-2402-v1:0')
            access_key/secret_key: Credentials from the S3 connection configured in the UI
        """
        client = self._get_client(region, access_key, secret_key, role_arn)
        
        # Use the model_id from UI selection (the 'or self.model_id' is just a safety fallback)
        model_to_use = model_id or self.model_id
        print(f"[DEBUG] Using model from UI selection: {model_to_use}")
        
        prompt = f"""
        You are a data quality and metadata extraction assistant. Analyze the following document content and extract comprehensive information.
        
        File Name: {file_name}
        
        Content:
        {content[:10000]}
        
        Extract and return ONLY a valid JSON object with the following structure:
        {{
            "file_name": "{file_name}",
            "document_type": "type of document (e.g., report, presentation, contract, email, etc.)",
            "summary": "A brief summary in 2-3 sentences describing the main content and purpose",
            "context": "The context or purpose of this document - why it exists and what it's used for",
            "metadata": {{
                "people": ["List of person names mentioned in the document with their roles if available, e.g., 'John Doe (CEO)', 'Jane Smith'"],
                "locations": ["List of locations, cities, countries, addresses mentioned"],
                "organizations": ["List of companies, organizations, institutions mentioned"],
                "dates": ["List of important dates, time periods, or deadlines mentioned"],
                "topics": ["List of main topics, themes, or subjects covered"],
                "emails": ["List of email addresses found"],
                "phones": ["List of phone numbers found"],
                "keywords": ["List of important keywords or technical terms"],
                "other": {{
                    "any_other_key": "any other important metadata you find"
                }}
            }},
            "quality_score": 85,
            "quality_notes": "Assessment of data quality, completeness, clarity, and any issues found"
        }}
        
        IMPORTANT: 
        - Extract ALL entities you can find in the document
        - If a category has no items, use an empty array []
        - Be thorough and extract as much relevant information as possible
        - Return ONLY the JSON object, no additional text
        """

        # Different models use different request formats
        if 'anthropic' in model_to_use.lower():
            # Claude format
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        elif 'mistral' in model_to_use.lower():
            # Mistral format
            body = json.dumps({
                "prompt": f"<s>[INST] {prompt} [/INST]",
                "max_tokens": 1000,
                "temperature": 0.7,
                "top_p": 0.9
            })
        else:
            # Generic format (try Claude format as fallback)
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })

        try:
            print(f"Invoking Bedrock model: {model_to_use}")
            response = client.invoke_model(
                modelId=model_to_use,
                body=body
            )
            
            response_body = json.loads(response['body'].read())
            print(f"Response body keys: {response_body.keys()}")
            
            # Extract text based on model type
            if 'anthropic' in model_to_use.lower():
                result_text = response_body['content'][0]['text']
            elif 'mistral' in model_to_use.lower():
                result_text = response_body['outputs'][0]['text']
            else:
                # Try to find text in common locations
                result_text = response_body.get('content', [{}])[0].get('text', '') or response_body.get('outputs', [{}])[0].get('text', '')
            
            # Extract JSON from the response (in case of extra text)
            start_idx = result_text.find('{')
            end_idx = result_text.rfind('}') + 1
            if start_idx != -1 and end_idx != -1:
                json_str = result_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                return {"error": "Failed to parse JSON response", "raw_response": result_text}

        except Exception as e:
            print(f"Error invoking Bedrock: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "summary": "Analysis failed",
                "error": str(e)
            }

    def get_embedding(self, text: str, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None) -> List[float]:
        """
        Generate embedding for text using Titan Embeddings v1.
        """
        client = self._get_client(region, access_key, secret_key, role_arn)
        model_id = "amazon.titan-embed-text-v1"
        
        try:
            body = json.dumps({
                "inputText": text
            })
            
            response = client.invoke_model(
                modelId=model_id,
                body=body
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
            
        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            return []
