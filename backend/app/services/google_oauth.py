"""Google OAuth token verification service."""

from dataclasses import dataclass
from typing import Optional

from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import get_settings


@dataclass
class GoogleUserInfo:
    """Verified Google user information."""

    google_id: str  # Google's 'sub' claim
    email: str
    email_verified: bool
    full_name: Optional[str]
    picture_url: Optional[str]


class GoogleOAuthService:
    """Service for verifying Google OAuth ID tokens."""

    def __init__(self, client_id: str):
        self.client_id = client_id

    async def verify_id_token(self, token: str) -> Optional[GoogleUserInfo]:
        """
        Verify a Google ID token and extract user information.

        Args:
            token: The ID token from Google Sign-In

        Returns:
            GoogleUserInfo if valid, None if verification fails

        Raises:
            ValueError: If token is invalid or expired
        """
        try:
            # Verify the token with Google's servers
            # This checks:
            # - Token signature
            # - Token expiration (exp claim)
            # - Audience matches our client ID (aud claim)
            # - Issuer is Google (iss claim)
            idinfo = id_token.verify_oauth2_token(
                token, requests.Request(), self.client_id
            )

            # Additional security checks
            if idinfo.get("iss") not in [
                "accounts.google.com",
                "https://accounts.google.com",
            ]:
                return None

            return GoogleUserInfo(
                google_id=idinfo["sub"],
                email=idinfo["email"],
                email_verified=idinfo.get("email_verified", False),
                full_name=idinfo.get("name"),
                picture_url=idinfo.get("picture"),
            )

        except ValueError:
            # Token is invalid
            return None


def get_google_oauth_service() -> GoogleOAuthService:
    """Dependency injection for Google OAuth service."""
    settings = get_settings()
    return GoogleOAuthService(client_id=settings.google_client_id)
