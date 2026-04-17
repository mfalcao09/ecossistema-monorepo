"""Middleware stack do template MCP server.

Ordem canônica (de fora para dentro):

    ErrorsMiddleware
    └── TracingMiddleware
        └── LoggingMiddleware
            └── RateLimitMiddleware
                └── (auth/tool handler)
"""

from .errors import ErrorsMiddleware
from .logging import LoggingMiddleware, configure_logging
from .rate_limit import RateLimitMiddleware
from .tracing import TracingMiddleware, configure_tracing

__all__ = [
    "ErrorsMiddleware",
    "LoggingMiddleware",
    "RateLimitMiddleware",
    "TracingMiddleware",
    "configure_logging",
    "configure_tracing",
]
