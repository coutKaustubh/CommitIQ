from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from supabase import create_client  
from django.conf import settings
import logging

# Logger setup - errors track karne ke liye
logger = logging.getLogger(__name__)

# Supabase client - anon key use karenge kyunki
# yeh public facing operations hain (signup/login)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


@api_view(['POST'])
def signup(request):
    """
    Naya user register karna
    Expected body: { "email": "...", "password": "..." }
    """
    try:
        email = request.data.get('email')
        password = request.data.get('password')

        # --- Validation ---
        # Dono fields zaroori hain
        if not email or not password:
            return Response(
                {'error': 'Email aur password dono zaroori hain'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Password kam se kam 6 characters ka hona chahiye
        if len(password) < 6:
            return Response(
                {'error': 'Password kam se kam 6 characters ka hona chahiye'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Supabase mein user banana ---
        response = supabase.auth.sign_up({
            "email": email,
            "password": password
        })

        # Agar user already exist karta hai
        if response.user is None:
            return Response(
                {'error': 'Kuch gadbad hui, dobara try karo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Success ---
        return Response(
            {
                'message': 'Account ban gaya! Email verify karo.',
                'user': {
                    'id': str(response.user.id),
                    'email': response.user.email,
                }
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        # Unexpected error - log karo aur generic message bhejo
        # User ko internal error details nahi dikhani chahiye
        logger.error(f"Signup error: {str(e)}")
        return Response(
            {'error': 'Server error aaya, baad mein try karo'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def login(request):
    """
    Existing user ka login
    Expected body: { "email": "...", "password": "..." }
    """
    try:
        email = request.data.get('email')
        password = request.data.get('password')

        # --- Validation ---
        if not email or not password:
            return Response(
                {'error': 'Email aur password dono zaroori hain'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Supabase se login karna ---
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        # --- Token frontend ko dena ---
        # Frontend yeh token localStorage mein save karega
        # Aur har request mein Authorization header mein bhejega
        return Response(
            {
                'message': 'Login ho gaya!',
                'access_token': response.session.access_token,
                'refresh_token': response.session.refresh_token,
                'user': {
                    'id': str(response.user.id),
                    'email': response.user.email,
                }
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Login error: {str(e)}")

        # Wrong email/password ka specific message
        # "Invalid login credentials" Supabase ka default error hai
        if 'Invalid login credentials' in str(e):
            return Response(
                {'error': 'Email ya password galat hai'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response(
            {'error': 'Server error aaya, baad mein try karo'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def me(request):
    """
    Logged in user ki apni details dekhna
    Yeh route protected hai - middleware token verify karega
    """
    try:
        # Middleware ne pehle se verify kar diya hai
        # aur request.supabase_user mein daal diya hai
        user = request.supabase_user

        return Response(
            {
                'id': str(user.id),
                'email': user.email,
                'created_at': str(user.created_at),
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Me endpoint error: {str(e)}")
        return Response(
            {'error': 'User details nahi mil payi'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def logout(request):
    """
    User ka logout
    Supabase session destroy karna
    """
    try:
        # Supabase session band karo
        supabase.auth.sign_out()

        return Response(
            {'message': 'Logout ho gaya!'},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return Response(
            {'error': 'Logout mein problem aayi'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        
        
@api_view(['GET'])
def github_login(request):
    """
    GitHub se login karna
    Supabase GitHub OAuth URL generate karega
    Frontend us URL pe redirect karega
    """
    try:
        # Supabase GitHub OAuth URL generate karta hai
        response = supabase.auth.sign_in_with_oauth({
            "provider": "github",
            "options": {
                # Login ke baad yahan redirect hoga
                "redirect_to": "http://localhost:5173/auth/callback"
            }
        })

        # Frontend ko URL dedo - woh redirect karega
        return Response(
            {'url': response.url},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"GitHub login error: {str(e)}")
        return Response(
            {'error': 'GitHub login mein problem aayi'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def auth_callback(request):
    """
    GitHub login ke baad Supabase yahan redirect karta hai
    Token exchange hota hai yahan
    """
    try:
        code = request.data.get('code')

        if not code:
            return Response(
                {'error': 'Code nahi mila'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Code se session banana
        response = supabase.auth.exchange_code_for_session(code)

        return Response(
            {
                'access_token': response.session.access_token,
                'refresh_token': response.session.refresh_token,
                'user': {
                    'id': str(response.user.id),
                    'email': response.user.email,
                }
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Auth callback error: {str(e)}")
        return Response(
            {'error': 'Authentication fail ho gayi'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )