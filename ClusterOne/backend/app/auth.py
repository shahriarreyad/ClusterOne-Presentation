"""Authentication: Keycloak/OIDC bearer tokens for users, a shared secret for node agents.

Both are off by default so local development needs no setup:
  CLUSTERONE_AUTH_ENABLED=true  -> user endpoints require a valid Keycloak access token
  CLUSTERONE_AGENT_TOKEN=<s>    -> node-agent endpoints require header X-Agent-Token: <s>
"""
import hmac
from dataclasses import dataclass
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.models import Job

_bearer = HTTPBearer(auto_error=False)
_jwk_client: Optional[jwt.PyJWKClient] = None


@dataclass(frozen=True)
class Principal:
    username: Optional[str]  # None when auth is disabled
    is_admin: bool


def _signing_key(token: str) -> Any:
    """The public key that signed `token`, fetched (and cached) from Keycloak's JWKS endpoint."""
    global _jwk_client
    if _jwk_client is None:
        url = settings.oidc_jwks_url or f"{(settings.oidc_issuer_url or '').rstrip('/')}/protocol/openid-connect/certs"
        _jwk_client = jwt.PyJWKClient(url, cache_keys=True)
    return _jwk_client.get_signing_key_from_jwt(token).key


def decode_token(token: str) -> Dict[str, Any]:
    key = _signing_key(token)
    issuer = settings.oidc_issuer_url or None
    if settings.oidc_audience:
        return jwt.decode(token, key, algorithms=["RS256", "ES256"], audience=settings.oidc_audience, issuer=issuer)
    # No audience configured: don't reject tokens just because they carry an `aud` claim.
    return jwt.decode(token, key, algorithms=["RS256", "ES256"], issuer=issuer, options={"verify_aud": False})


def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    x_api_key: Optional[str] = Header(default=None),
) -> Principal:
    if not settings.auth_enabled:
        # Lightweight protection for a LAN deployment without Keycloak: one shared key for everyone who may
        # submit jobs (header X-API-Key, or `Authorization: Bearer <key>`). Off unless CLUSTERONE_API_KEY is set.
        key = settings.api_key.get_secret_value() if settings.api_key else None
        if key:
            supplied = x_api_key or (creds.credentials if creds else None)
            if not supplied or not hmac.compare_digest(supplied, key):
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing or invalid API key",
                                    headers={"WWW-Authenticate": "Bearer"})
        return Principal(username=None, is_admin=True)
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = decode_token(creds.credentials)
    except (jwt.PyJWTError, OSError) as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token", headers={"WWW-Authenticate": "Bearer"}) from e
    username = claims.get(settings.oidc_username_claim)
    if not username:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"token has no '{settings.oidc_username_claim}' claim")
    groups = {str(g).lstrip("/") for g in claims.get(settings.oidc_groups_claim, []) or []}
    return Principal(username=str(username), is_admin=settings.oidc_admin_group in groups)


def agent_only(
    x_agent_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> None:
    """Node-agent calls: header X-Agent-Token, or `Authorization: Bearer <same secret>` (the Linux agent's style)."""
    secret = settings.agent_token.get_secret_value() if settings.agent_token else None
    if not secret:
        return
    supplied = x_agent_token
    if not supplied and authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:].strip()
    if not supplied or not hmac.compare_digest(supplied, secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or missing agent token")


def require_access(principal: Principal, job: Job) -> None:
    """With auth on, a job belongs to its submitter; admins see everything."""
    if principal.username is None or principal.is_admin or job.submitted_by == principal.username:
        return
    # 404 rather than 403 so job ids of other users are not confirmed to exist.
    raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
