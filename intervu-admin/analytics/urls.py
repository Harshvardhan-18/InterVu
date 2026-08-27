"""
analytics/urls.py
------------------
DRF router registration for the analytics app.

Registered endpoints:
  /api/users/                       UserViewSet
  /api/users/<id>/interviews/       custom action
  /api/interviews/                  InterviewViewSet (filterable list)
  /api/interviews/<id>/             detail
  /api/interviews/<id>/evaluations/ custom action (key analytics endpoint)
  /api/interviews/<id>/report/      custom action
  /api/research-profiles/           ResearchProfileViewSet
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InterviewViewSet, ResearchProfileViewSet, UserViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"interviews", InterviewViewSet, basename="interview")
router.register(r"research-profiles", ResearchProfileViewSet, basename="researchprofile")

urlpatterns = [
    path("", include(router.urls)),
]
