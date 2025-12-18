import boto3
import json
from typing import List, Dict

class BedrockService:
    def __init__(self, aws_access_key: str, aws_secret_key: str, region: str = "us-east-1"):
        # We create a session using the user's specific keys
        self.client = boto3.client(
            service_name='bedrock-runtime',
            region_name=region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_access_key
        )
        # Using Claude 3.5 Sonnet (Best for coding)
        self.model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"

    async def chat_completion(self, messages: List[Dict[str, str]]) -> str:
        """
        Sends chat history to AWS Bedrock (Claude 3.5) and returns the text response.
        """
        try:
            # 1. Format messages for Claude 3 API
            # Claude expects: {"role": "user", "content": "..."}
            # Note: System prompts are handled differently in Bedrock/Claude 3, 
            # but for simplicity we will pass them as part of the message flow or a separate field if needed.
            
            payload = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "messages": messages,
                "temperature": 0.1  # Low temp is better for code
            }

            # 2. Call AWS
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(payload)
            )

            # 3. Parse Response
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']

        except Exception as e:
            print(f"AWS Bedrock Error: {e}")
            return f"Error connecting to AWS Cloud: {str(e)}"
