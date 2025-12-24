import boto3
import json
from typing import List, Dict, Any, Optional
from botocore.exceptions import ClientError

class BedrockService:
    def __init__(self, aws_access_key: str, aws_secret_key: str, region: str = "us-east-1", aws_session_token: Optional[str] = None):
        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name=region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            aws_session_token=aws_session_token
        )
        # Default to Claude 3 Sonnet for high quality code generation
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"

    async def chat_completion(self, messages: List[Dict[str, str]]) -> str:
        """
        Sends messages to AWS Bedrock (Claude 3) and returns the response.
        """
        try:
            # Convert OpenAI-style messages to Anthropic/Bedrock format if necessary
            # Bedrock/Claude 3 expects a specific structure
            
            # Simple conversion for system prompts:
            system_prompts = []
            user_assistant_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_prompts.append({"text": msg["content"]})
                else:
                    user_assistant_messages.append({
                        "role": msg["role"],
                        "content": [{"text": msg["content"]}]
                    })

            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "system": system_prompts,
                "messages": user_assistant_messages,
                "temperature": 0.5,
                "top_p": 0.9,
            })

            response = self.client.invoke_model(
                body=body,
                modelId=self.model_id,
                accept="application/json",
                contentType="application/json"
            )

            response_body = json.loads(response.get("body").read())
            return response_body.get("content")[0].get("text")

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            
            print(f"Bedrock ClientError: {error_code} - {error_msg}")

            if error_code in ["InvalidSignatureException", "AccessDeniedException", "UnrecognizedClientException"]:
                return f"⚠️ AWS Authentication Error: Invalid credentials or permissions. Please check your Access Key, Secret Key, and Region. ({error_code})"
            elif error_code == "ValidationException":
                 return f"⚠️ AWS Configuration Error: {error_msg}. Check if the model ID '{self.model_id}' is available in your region."
            elif error_code == "ThrottlingException":
                return "⚠️ AWS Quota Exceeded: Request throttled. Please try again later."
            elif error_code == "ServiceQuotaExceededException":
                return "⚠️ AWS Quota Exceeded: You have reached your service quota for this model."
            elif error_code == "ModelNotReadyException":
                 return "⚠️ AWS Model Error: The selected model is overloaded or not ready. Please retry."
            else:
                return f"⚠️ AWS Cloud Error: {error_msg} ({error_code})"

        except Exception as e:
            print(f"Bedrock Error: {str(e)}")
            return f"Error communicating with Bedrock: {str(e)}"
