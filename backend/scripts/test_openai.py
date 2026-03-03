#!/usr/bin/env python3
"""
Test script to verify OpenAI API connection and quota.

Usage:
    # From backend directory (auto-loads .env):
    poetry run python scripts/test_openai.py

    # Or inside Docker container:
    docker-compose exec backend poetry run python scripts/test_openai.py
"""

import os
import sys
from pathlib import Path


def load_env():
    """Load .env file from backend directory or root."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("WARNING: python-dotenv not installed, relying on environment variables")
        return

    # Try backend/.env first, then root .env
    script_dir = Path(__file__).resolve().parent
    backend_dir = script_dir.parent
    root_dir = backend_dir.parent

    for env_path in [backend_dir / ".env", root_dir / ".env"]:
        if env_path.exists():
            load_dotenv(env_path)
            print(f"Loaded: {env_path}")
            return

    print("WARNING: No .env file found")


def test_openai_connection():
    # Load environment from .env files
    load_env()

    # Check if API key is set
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY not found in .env or environment")
        print("\nAdd to backend/.env or root .env:")
        print("  OPENAI_API_KEY=your-api-key")
        print("\nGet your API key from: https://platform.openai.com/api-keys")
        sys.exit(1)

    print(f"API Key: {api_key[:10]}...{api_key[-4:]}")

    # Import and initialize client
    try:
        import openai

        print(f"openai version: {openai.__version__}")
    except ImportError:
        print("ERROR: openai package not installed")
        print("Install with: poetry add openai")
        sys.exit(1)

    # Create client
    client = openai.OpenAI(api_key=api_key)

    # Get model from env or use default
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    print(f"Testing model: {model}")
    print("-" * 40)

    # Test generation
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'API connection successful!' and nothing else."},
            ],
            max_tokens=50,
        )
        print("SUCCESS!")
        print(f"Response: {response.choices[0].message.content}")
    except openai.AuthenticationError as e:
        print(f"AUTHENTICATION ERROR: {e}")
        print("\nThis means your API key is invalid or expired.")
        print("Get a new key from: https://platform.openai.com/api-keys")
        sys.exit(1)
    except openai.RateLimitError as e:
        print(f"RATE LIMIT ERROR: {e}")
        print("\nThis is a quota/rate limit error. Your options:")
        print("1. Check your usage at https://platform.openai.com/usage")
        print("2. Add billing info if you haven't: https://platform.openai.com/settings/organization/billing")
        print("3. Wait for your rate limit to reset")
        sys.exit(1)
    except openai.APIError as e:
        print(f"API ERROR: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(1)

    # Test embeddings
    print("\n" + "-" * 40)
    embedding_model = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    print(f"Testing embedding model: {embedding_model}")

    try:
        response = client.embeddings.create(
            model=embedding_model,
            input="Test embedding generation.",
        )
        embedding = response.data[0].embedding
        print(f"SUCCESS! Embedding dimensions: {len(embedding)}")
    except openai.AuthenticationError as e:
        print(f"AUTHENTICATION ERROR: {e}")
        sys.exit(1)
    except openai.RateLimitError as e:
        print(f"RATE LIMIT ERROR: {e}")
        sys.exit(1)
    except openai.APIError as e:
        print(f"API ERROR: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(1)

    print("\n" + "=" * 40)
    print("All OpenAI API tests passed!")
    print("=" * 40)


if __name__ == "__main__":
    test_openai_connection()
