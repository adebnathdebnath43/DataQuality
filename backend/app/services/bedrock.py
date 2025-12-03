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

    def analyze_content(self, content: str, file_name: str, model_id: str = None, region: str = None, access_key: str = None, secret_key: str = None, role_arn: str = None, additional_prompt: str = "") -> Dict[str, Any]:
        """
        Analyze file content using Bedrock to extract metadata, summary, and context.
        
        Args:
            model_id: The Bedrock model ID selected by the user from the UI dropdown.
                     This is ALWAYS passed from the UI selection (e.g., 'mistral.mistral-large-2402-v1:0')
            access_key/secret_key: Credentials from the S3 connection configured in the UI
            additional_prompt: Optional additional instructions (e.g., dimension-specific feedback for re-analysis)
        """
        client = self._get_client(region, access_key, secret_key, role_arn)
        
        # Use the model_id from UI selection (the 'or self.model_id' is just a safety fallback)
        model_to_use = model_id or self.model_id
        print(f"[DEBUG] Using model from UI selection: {model_to_use}")
        
        prompt = f"""You are the world's most rigorous Enterprise Data Quality & Governance Agent. Your judgment determines whether multi-million-dollar decisions and regulated AI systems are allowed to use a document. You have been trained on thousands of real post-mortem incidents of data-quality failures that caused financial loss, regulatory fines, or emergency model rollbacks.

Your task: Carefully analyze the provided unstructured document and assign an accurate numerical score from 0 to 100 for ALL 17 dimensions below. You must use the exact definitions and scoring rubrics provided. Never invent dimensions. Never skip one.

You are not allowed to be lenient. If in doubt, score lower and explain why.

RETURN ONLY STRICTLY VALID JSON — nothing else, no markdown, no extra text.

=== THE 17 DIMENSIONS ===

1. Accuracy (Data correctly represents reality)
   100 = All facts, dates, numbers, entities provably correct
   70 = One minor typo that doesn't change meaning
   30 = Impossible date or wrong amount
   0 = Multiple critical factual errors

2. Completeness (Nothing required is missing)
   100 = All pages, exhibits, tables, signatures present
   0 = Large sections or entire document missing

3. Consistency (Uniform representation, no contradictions)
   100 = Entity names, date/number formats, terminology identical throughout
   0 = Contradictory clauses or wildly inconsistent formatting

4. Timeliness (Current and not superseded)
   100 = Clearly the final/executed/latest version
   50 = Old draft with no clear execution date
   0 = Known to be superseded

5. Validity (Conforms to rules and formats)
   100 = All dates, currencies, IDs, structures follow standards
   0 = Multiple malformed fields

6. Uniqueness (No duplicates or near-duplicates)
   100 = Clearly unique or meaningfully different version
   0 = Likely duplicate copy already in corpus

7. Reliability (Source and process are trustworthy)
   100 = Official source (law firm, SEC filing, signed PDF)
   0 = Unknown origin or unverified source

8. Relevance (Useful for the intended business purpose)
   100 = Directly relevant (contract, financials, board minutes)
   0 = Completely off-topic personal content

9. Accessibility (Can be retrieved and parsed easily)
   100 = No password, renders perfectly, text selectable
   0 = Encrypted, corrupted, or unparseable

10. Precision (Right level of granularity)
    100 = Numbers have required decimal places
    0 = Excessive or insufficient precision

11. Integrity (Relationships and constraints preserved)
    100 = Totals add up, references correct
    0 = Broken referential integrity

12. Conformity (Follows organizational/industry standards)
    100 = Matches expected template/structure
    0 = Deviates heavily from standard

13. Interpretability (Meaning is clear)
    100 = Clear language, defined terms, good metadata
    0 = Heavy jargon with no glossary

14. Traceability (Clear origin and version history)
    100 = Clear filename, version, author, date
    0 = No provenance whatsoever

15. Credibility (Believable and from reputable source)
    100 = Signed by reputable firm or authority
    0 = Obvious forgery or joke document

16. Fitness_for_Use (Actually usable for target AI/business tasks)
    100 = High signal-to-noise, dense useful content
    0 = Pure fluff or placeholders

17. Value (Business benefit vs. risk/cost of ingestion)
    100 = High ROI, low risk
    0 = High risk of bias, toxicity, PII, or legal exposure

=== STRICT JSON OUTPUT FORMAT ===

{{
  "file_name": "{file_name}",
  "document_type": "type of document",
  "summary": "Brief 2-3 sentence summary",
  "context": "Purpose and use of this document",
  "metadata": {{
    "people": ["person names with roles"],
    "locations": ["locations mentioned"],
    "organizations": ["companies, institutions"],
    "dates": ["important dates"],
    "topics": ["main topics covered"],
    "emails": ["email addresses"],
    "phones": ["phone numbers"],
    "keywords": ["important keywords"]
  }},
  "quality_score": 85,
  "quality_notes": "Overall quality assessment",
  "overall_quality_score": 89,
  "recommended_action": "KEEP",
  "dimensions": {{
    "Accuracy": {{"score": 0-100, "evidence": "Evidence text"}},
    "Completeness": {{"score": 0-100, "evidence": "Evidence text"}},
    "Consistency": {{"score": 0-100, "evidence": "Evidence text"}},
    "Timeliness": {{"score": 0-100, "evidence": "Evidence text"}},
    "Validity": {{"score": 0-100, "evidence": "Evidence text"}},
    "Uniqueness": {{"score": 0-100, "evidence": "Evidence text"}},
    "Reliability": {{"score": 0-100, "evidence": "Evidence text"}},
    "Relevance": {{"score": 0-100, "evidence": "Evidence text"}},
    "Accessibility": {{"score": 0-100, "evidence": "Evidence text"}},
    "Precision": {{"score": 0-100, "evidence": "Evidence text"}},
    "Integrity": {{"score": 0-100, "evidence": "Evidence text"}},
    "Conformity": {{"score": 0-100, "evidence": "Evidence text"}},
    "Interpretability": {{"score": 0-100, "evidence": "Evidence text"}},
    "Traceability": {{"score": 0-100, "evidence": "Evidence text"}},
    "Credibility": {{"score": 0-100, "evidence": "Evidence text"}},
    "Fitness_for_Use": {{"score": 0-100, "evidence": "Evidence text"}},
    "Value": {{"score": 0-100, "evidence": "Evidence text"}}
  }}
}}

=== CRITICAL EVIDENCE REQUIREMENTS ===

For ANY dimension scored BELOW 90, your evidence MUST include:
1. A SPECIFIC QUOTE or example from the document (use quotation marks)
2. EXACTLY what is wrong, missing, or problematic
3. A concrete example of what would improve the score to 90+

GOOD EVIDENCE EXAMPLE (score 75 on Completeness):
"The document is missing page 3 (jumps from page 2 directly to page 4). The table of contents lists 'Section 2.3: Risk Analysis' but this section is not present. To reach 90+, the missing page and section must be added."

BAD EVIDENCE EXAMPLE (too vague):
"Some sections appear to be missing."

For scores 90 or above, brief evidence is acceptable.

{additional_prompt}

NOW ANALYZE THIS DOCUMENT:

File name: {file_name}
Content (first 10000 chars):
{content[:10000]}

Return ONLY the JSON above. Begin immediately.
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
            
            # Debug: Log the raw response
            print(f"[DEBUG] Raw LLM response (first 500 chars): {result_text[:500]}")
            
            # Extract JSON from the response (handle markdown code blocks)
            json_str = result_text
            
            # Remove markdown code blocks if present
            if '```json' in result_text:
                start_idx = result_text.find('```json') + 7
                end_idx = result_text.find('```', start_idx)
                if end_idx != -1:
                    json_str = result_text[start_idx:end_idx].strip()
            elif '```' in result_text:
                start_idx = result_text.find('```') + 3
                end_idx = result_text.find('```', start_idx)
                if end_idx != -1:
                    json_str = result_text[start_idx:end_idx].strip()
            else:
                # Find JSON object boundaries
                start_idx = result_text.find('{')
                end_idx = result_text.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    json_str = result_text[start_idx:end_idx]
            
            if json_str:
                parsed = json.loads(json_str)
                print(f"[DEBUG] Parsed JSON keys: {parsed.keys()}")
                print(f"[DEBUG] Has dimensions: {'dimensions' in parsed}")
                return parsed
            else:
                return {"error": "Failed to parse JSON response", "raw_response": result_text[:1000]}

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
