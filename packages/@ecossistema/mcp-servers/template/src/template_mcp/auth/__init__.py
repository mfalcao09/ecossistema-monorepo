"""Auth verifiers e scopes para o MCP server (FastMCP v3)."""

from .owner_token import OwnerTokenVerifier, hash_token
from .scopes import SCOPES, get_required_scope, has_scope, require_scope
from .supabase_jwt import SupabaseJWTVerifier

__all__ = [
    "OwnerTokenVerifier",
    "SCOPES",
    "SupabaseJWTVerifier",
    "get_required_scope",
    "has_scope",
    "hash_token",
    "require_scope",
]
