"""Auth providers e scopes para o MCP server."""

from .owner_token import OwnerTokenProvider
from .scopes import SCOPES, get_required_scope, has_scope, require_scope
from .supabase_jwt import SupabaseJWTProvider

__all__ = [
    "SCOPES",
    "OwnerTokenProvider",
    "SupabaseJWTProvider",
    "get_required_scope",
    "has_scope",
    "require_scope",
]
