from django.http import JsonResponse
from supabase import create_client
from django.conf import settings

# Supabase client banana - service key use karenge kyunki
# yeh backend pe hai, frontend pe nahi
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

# Yeh routes token ke bina chalenge
# Kyunki signup/login pe token hota hi nahi abhi tak
EXEMPT_ROUTES = [
    '/api/users/signup/',
    '/api/users/login/',
]

class SupabaseAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        # Exempt routes ko skip karo
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