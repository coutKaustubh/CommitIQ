from django.http import JsonResponse
from supabase import create_client # type: ignore
from django.conf import settings

# Supabase client banana - service key use karenge kyunki
# yeh backend pe hai, frontend pe nahi
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

# Yeh routes token ke bina chalenge
# Kyunki signup/login pe token hota hi nahi abhi tak
EXEMPT_ROUTES = [
    '/api/health/',
    '/api/users/signup/',
    '/api/users/login/',
    '/api/users/github-login/',
    '/api/users/callback/',
    
    
    '/api/webhooks/github/',
    # GitHub webhook exempt — git push pe GitHub ka SERVER call karta hai, user nahi.
    # Iske paas Supabase JWT / Authorization: Bearer header nahi hota.
    # Agar yahan exempt na karein to middleware 401 "No Token provided" dega
    # aur github_webhook view tak request pahunchegi hi nahi.
    # Security yahan nahi chhooti — webhook_views.py mein X-Hub-Signature-256
    # + GITHUB_WEBHOOK_SECRET se HMAC verify hota hai (webhook_utils.py).
]

class SupabaseAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        # Browser CORS preflight — token nahi hota, block mat karo
        if request.method == 'OPTIONS':
            return self.get_response(request)

        # JWT check sirf /api/* pe — /admin/ aur ngrok root browser se token maange nahi
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # Exempt API routes (signup, login, webhook, …)
        if request.path in EXEMPT_ROUTES:
            return self.get_response(request)

        # Header se token uthao
        # "Authorization: Bearer eyJhbG..." → sirf token chahiye
        auth_header = request.headers.get('Authorization', '') 
        token = auth_header.replace('Bearer ', '').strip()

        # Token hai hi nahi
        if not token:
            return JsonResponse(
                {'error': 'No Token provided'},
                status=401
            )

        try:
            # Supabase se verify karo
            user = supabase.auth.get_user(token)
            # User ko request mein daal do
            # Ab har view mein request.supabase_user se milega
            request.supabase_user = user.user

        except Exception:
            return JsonResponse(
                {'error': 'Invalid token hai'},
                status=401
            )

        # Sab theek hai - request aage bhejo
        return self.get_response(request)