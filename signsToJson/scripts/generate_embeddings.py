import json
import requests
import os
import sys
from typing import List, Dict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Load from worker .dev.vars if CF credentials not in current .env
worker_env_path = os.path.join(os.path.dirname(__file__), '../../signos/worker/.dev.vars')
if os.path.exists(worker_env_path):
    with open(worker_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                if key not in os.environ:
                    os.environ[key] = value

CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")

if not CF_ACCOUNT_ID or not CF_API_TOKEN:
    print("Error: CF_ACCOUNT and CF_API_TOKEN must be set")
    print("Check your .dev.vars file or environment variables")
    sys.exit(1)

def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Cloudflare Workers AI."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5"

    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json={
        "text": [text]
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code} - {response.text}")

    result = response.json()
    return result["result"]["data"][0]  # 768-dimensional vector

def add_embeddings_to_signs(input_json: str, output_json: str) -> None:
    """Add embedding vectors to each sign."""
    with open(input_json, 'r', encoding='utf-8') as f:
        signs = json.load(f)

    print(f"Generating embeddings for {len(signs)} signs...")

    for i, sign in enumerate(signs):
        try:
            # Use search_text for embedding (translations + definition)
            embedding = generate_embedding(sign["search_text"])
            sign["embedding"] = embedding

            if (i + 1) % 50 == 0:
                print(f"Progress: {i + 1}/{len(signs)}")

        except Exception as e:
            print(f"Error generating embedding for {sign['glosa']}: {e}")
            sign["embedding"] = None

    # Filter out signs without embeddings
    valid_signs = [s for s in signs if s.get("embedding")]

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(valid_signs, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(valid_signs)} signs with embeddings to {output_json}")

if __name__ == '__main__':
    add_embeddings_to_signs('output/signs_complete.json', 'output/signs_vectorized.json')
