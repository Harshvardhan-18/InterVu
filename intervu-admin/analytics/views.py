"""
analytics/views.py
-------------------
DRF ViewSets for the read-only InterVu analytics API.

All viewsets extend ReadOnlyModelViewSet, which exposes only:
  GET /api/<resource>/          - list
  GET /api/<resource>/<pk>/     - retrieve

Additionally, some viewsets expose nested sub-resources via @action decorators,
e.g. GET /api/interviews/<pk>/evaluations/

Authentication: Django session auth or JWT (configured in settings.py).
Permission: IsAdminUser by default.
"""

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.viewsets import ReadOnlyModelViewSet

from .filters import InterviewFilter, ResearchProfileFilter
from .models import Interview, Question, Report, ResearchProfile, Response, User
from .serializers import (
    InterviewDetailSerializer,
    InterviewListSerializer,
    QuestionWithResponseSerializer,
    ReportSerializer,
    ResearchProfileSerializer,
    ResponseSerializer,
    UserSerializer,
)


class UserViewSet(ReadOnlyModelViewSet):
    """
    GET /api/users/           - list all users
    GET /api/users/<id>/      - retrieve a single user
    GET /api/users/<id>/interviews/  - list interviews for a user
    """

    queryset = User.objects.using("intervu").all()
    serializer_class = UserSerializer
    search_fields = ["name", "email"]
    ordering_fields = ["created_at", "name", "email"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["get"], url_path="interviews")
    def interviews(self, request, pk=None):
        """Return all interviews for a specific user."""
        user = self.get_object()
        interviews = Interview.objects.using("intervu").filter(user=user).order_by("-created_at")
        serializer = InterviewListSerializer(interviews, many=True)
        return DRFResponse(serializer.data)


class InterviewViewSet(ReadOnlyModelViewSet):
    """
    GET /api/interviews/                    - list all interviews (filterable)
    GET /api/interviews/<id>/              - retrieve a single interview
    GET /api/interviews/<id>/evaluations/  - responses+scores for an interview
    GET /api/interviews/<id>/report/       - evaluation report for an interview
    """

    queryset = (
        Interview.objects
        .using("intervu")
        .select_related("user")
        .prefetch_related("questions__response")
        .order_by("-created_at")
    )
    filterset_class = InterviewFilter
    search_fields = ["company", "role", "user__email", "user__name"]
    ordering_fields = ["created_at", "company", "role", "status", "difficulty"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Use compact list serializer for lists, detailed for single retrieve."""
        if self.action == "list":
            return InterviewListSerializer
        return InterviewDetailSerializer

    @action(detail=True, methods=["get"], url_path="evaluations")
    def evaluations(self, request, pk=None):
        """
        GET /api/interviews/<id>/evaluations/

        Returns all questions and their associated response evaluations for
        a given interview session. This is the primary analytics endpoint.
        """
        interview = self.get_object()
        questions = (
            Question.objects
            .using("intervu")
            .filter(interview=interview)
            .select_related("response")
            .order_by("order_index")
        )
        serializer = QuestionWithResponseSerializer(questions, many=True)
        return DRFResponse({
            "interview_id": interview.id,
            "company": interview.company,
            "role": interview.role,
            "status": interview.status,
            "question_count": questions.count(),
            "questions": serializer.data,
        })

    @action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        """
        GET /api/interviews/<id>/report/

        Returns the final evaluation report for an interview, if one exists.
        """
        interview = self.get_object()
        try:
            report = Report.objects.using("intervu").get(interview=interview)
        except Report.DoesNotExist:
            return DRFResponse(
                {"detail": "No report available for this interview yet."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ReportSerializer(report)
        return DRFResponse(serializer.data)


class ResearchProfileViewSet(ReadOnlyModelViewSet):
    """
    GET /api/research-profiles/          - list all research profiles
    GET /api/research-profiles/<id>/     - retrieve a single profile
    """

    queryset = ResearchProfile.objects.using("intervu").all()
    serializer_class = ResearchProfileSerializer
    filterset_class = ResearchProfileFilter
    search_fields = ["company", "role"]
    ordering_fields = ["company", "role", "difficulty", "created_at", "updated_at"]
    ordering = ["company", "role"]
