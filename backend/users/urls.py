from django.urls import path
from . import views

urlpatterns = [
    # --- Auth Routes ---
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),

    # --- GitHub OAuth Routes ---
    path('github-login/', views.github_login, name='github-login'),
    path('callback/', views.auth_callback, name='auth-callback'),
]