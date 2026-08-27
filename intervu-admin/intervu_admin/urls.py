"""
intervu_admin/urls.py
─────────────────────
Root URL configuration.
  /admin/          — Django admin UI
  /api/            — DRF endpoints (analytics app)
  /api/token/      — JWT token pair (login)
  /api/token/refresh/ — JWT refresh
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("analytics.urls")),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
