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
    """
    Login / signup brute-force slow karne ke liye — IP pe rate limit.

    Line-by-line (Hindi):

    - class AuthIPRateThrottle(AnonRateThrottle):
      DRF ka AnonRateThrottle inherit kiya — yeh un requests ke liye hai
      jahan Django/Supabase logged-in user identify nahi hota (login/signup pe
      abhi token nahi hota).

    - scope = "auth":
      settings.py mein DEFAULT_THROTTLE_RATES['auth'] se rate uthayega.
      Default: 5 requests / minute (THROTTLE_AUTH env se badal sakte ho).

    - Kaam kaise karta hai:
      1) Request aati hai (e.g. POST /api/users/login/)
      2) DRF client IP nikalta hai (X-Forwarded-For ya REMOTE_ADDR)
      3) Redis mein key banti hai: throttle_auth_<IP>
      4) Counter badhta hai — agar 5/min se zyada → HTTP 429
      5) Window reset hone ke baad dubara try kar sakte ho

    - Kahan lagaya hai: users/views.py → login, signup decorators pe
    - Kyun IP, user ID nahi: login pe JWT/Supabase user abhi milta hi nahi
    """
    scope = "auth"
