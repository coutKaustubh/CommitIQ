"""
DRF throttling keyed on Supabase user (Ask AI) or client IP (auth endpoints).
"""

from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


class SupabaseScopedRateThrottle(ScopedRateThrottle):
    """Per Supabase user — views set throttle_scope or subclass with scope."""

    def get_cache_key(self, request, view):
        user = getattr(request, "supabase_user", None)
        if user is None:
            return None

        scope = getattr(view, "throttle_scope", self.scope)
        if scope is None:
            return None

        return self.cache_format % {"scope": scope, "ident": user.id}


class AskAIRateThrottle(SupabaseScopedRateThrottle):
    scope = "ask_ai"


class AuthIPRateThrottle(AnonRateThrottle):
    scope = "auth"
