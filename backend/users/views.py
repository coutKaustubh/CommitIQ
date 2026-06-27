from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework import status

from core.throttling import AuthIPRateThrottle
from supabase import create_client # type: ignore
from django.conf import settings
import logging

from repos.models import UserProfile
from repos.github_client import fetch_github_user_info

# Logger setup - errors track karne ke liye
logger = logging.getLogger(__name__)

# Supabase client - anon key use karenge kyunki
# yeh public facing operations hain (signup/login)
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def _display_name_for(profile):
    """GitHub real name → username → email prefix."""
    if profile.github_display_name:
        return profile.github_display_name
    if profile.github_username:
        return profile.github_username
    if profile.email and "@" in profile.email:
        return profile.email.split("@", 1)[0]
    return "developer"


def _refresh_github_profile_fields(profile):
    """Fetch GitHub name/login when we have a token but profile fields are empty."""
    if not profile.github_access_token:
        return

    needs_login = not profile.github_username
    needs_name = not profile.github_display_name
    if not needs_login and not needs_name:
        return

    info = fetch_github_user_info(profile.github_access_token)
    updates = []
    if info["login"] and profile.github_username != info["login"]:
        profile.github_username = info["login"]
        updates.append("github_username")
    if info["name"] and profile.github_display_name != info["name"]:
        profile.github_display_name = info["name"]
        updates.append("github_display_name")
    if updates:
        updates.append("updated_at")
        profile.save(update_fields=updates)


@api_view(['POST'])
@throttle_classes([AuthIPRateThrottle])
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
                {'error': 'Both email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Password kam se kam 6 characters ka hona chahiye
        if len(password) < 6:
            return Response(
                {'error': 'Password must be at least 6 characters long'},
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
                {'error': 'Something went wrong, please try again'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Success ---
        return Response(
            {
                'message': 'Account created! Please verify your email.',
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
            {'error': 'Server error occurred, please try again later'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@throttle_classes([AuthIPRateThrottle])
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
                {'error': 'Both email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # --- Supabase se login karna ---
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        # Email login has no GitHub provider token — clear stale token from past OAuth
        profile, _ = UserProfile.objects.get_or_create(
            supabase_user_id=response.user.id,
            defaults={'email': response.user.email or email},
        )
        if profile.github_access_token or profile.github_username:
            profile.github_access_token = ''
            profile.github_username = ''
            profile.github_display_name = ''
            profile.save(
                update_fields=[
                    'github_access_token',
                    'github_username',
                    'github_display_name',
                    'updated_at',
                ]
            )

        # --- Token frontend ko dena ---
        return Response(
            {
                'message': 'Login successful!',
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
                {'error': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        return Response(
            {'error': 'Server error occurred, please try again later'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def me(request):
    """
    Logged in user ki apni details dekhna.
    Protected route — middleware token verify karta hai.
    UserProfile DB row get_or_create (Supabase user bridge).
    """
    try:
        # Middleware ne pehle se verify kar diya hai
        # aur request.supabase_user mein daal diya hai
        user = request.supabase_user

        if not user.email:
            return Response(
                {'error': 'Account email not available'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, profile_created = UserProfile.objects.get_or_create(
            supabase_user_id=user.id,
            defaults={'email': user.email},
        )

        if not profile_created and profile.email != user.email:
            profile.email = user.email
            profile.save(update_fields=['email', 'updated_at'])

        _refresh_github_profile_fields(profile)

        return Response(
            {
                'id': str(user.id),
                'email': user.email,
                'created_at': str(user.created_at),
                'profile_id': profile.id,
                'github_username': profile.github_username,
                'github_display_name': profile.github_display_name,
                'display_name': _display_name_for(profile),
                'has_github_token': bool(profile.github_access_token),
                'profile_created': profile_created,
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Me endpoint error: {str(e)}")
        return Response(
            {'error': 'User details not found'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def sync_github_token(request):
    """
    Save GitHub OAuth provider token from Supabase session (frontend sends after GitHub login).
    Body: { "github_access_token": "..." }
    """
    try:
        user = request.supabase_user
        token = (request.data.get('github_access_token') or '').strip()

        if not token:
            return Response(
                {'error': 'github_access_token is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email:
            return Response(
                {'error': 'Account email not available'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile, _ = UserProfile.objects.get_or_create(
            supabase_user_id=user.id,
            defaults={'email': user.email},
        )

        profile.github_access_token = token
        info = fetch_github_user_info(token)
        if info["login"]:
            profile.github_username = info["login"]
        if info["name"]:
            profile.github_display_name = info["name"]
        profile.save(
            update_fields=[
                'github_access_token',
                'github_username',
                'github_display_name',
                'updated_at',
            ]
        )

        return Response(
            {
                'message': 'GitHub token saved',
                'github_username': profile.github_username,
                'github_display_name': profile.github_display_name,
                'display_name': _display_name_for(profile),
                'has_github_token': True,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.error(f"sync_github_token error: {str(e)}")
        return Response(
            {'error': 'Could not save GitHub token'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            {'message': 'Logout successful!'},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return Response(
            {'error': 'Server error occurred, please try again later'},
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
            {'error': 'Server error occurred, please try again later'},
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
                {'error': 'Code not found'},
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
            {'error': 'Authentication failed, please try again later'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )