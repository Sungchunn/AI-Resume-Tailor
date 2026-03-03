#!/usr/bin/env python3
"""
Test script to verify Gemini API connection and quota.

Usage:
    # From backend directory (auto-loads .env):
    poetry run python scripts/test_gemini.py

    # Or inside Docker container:
    docker-compose exec backend poetry run python scripts/test_gemini.py
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


def test_gemini_connection():
    # Load environment from .env files
    load_env()

    # Check if API key is set
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found in .env or environment")
        print("\nAdd to backend/.env or root .env:")
        print("  GEMINI_API_KEY=your-api-key")
        sys.exit(1)

    print(f"API Key: {api_key[:10]}...{api_key[-4:]}")

    # Import and initialize client
    try:
        from google import genai
        from google.genai import errors

        print(f"google-genai version: {genai.__version__}")
    except ImportError:
        print("ERROR: google-genai package not installed")
        print("Install with: pip install google-genai")
        sys.exit(1)

    # Create client
    client = genai.Client(api_key=api_key)

    # Get model from env or use default
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    print(f"Testing model: {model}")
    print("-" * 40)

    # Test generation
    try:
        response = client.models.generate_content(
            model=model,
            contents="Say 'API connection successful!' and nothing else.",
        )
        print("SUCCESS!")
        print(f"Response: {response.text}")
    except errors.APIError as e:
        print(f"API ERROR: {e.message}")
        print(f"Code: {e.code}")
        if e.code == 429:
            print("\nThis is a quota error. Your options:")
            print("1. Create a new API key from https://aistudio.google.com/apikey")
            print("2. Wait for quota to reset (usually daily)")
            print("3. Enable billing on your Google Cloud project")
        elif e.code == 400:
            print("\nThis is likely an invalid API key or model name.")
        sys.exit(1)
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    test_gemini_connection()
