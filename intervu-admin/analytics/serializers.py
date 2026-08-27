"""
analytics/serializers.py
-------------------------
DRF serializers for the read-only InterVu analytics API.

Serializers are intentionally flat / explicit rather than using
ModelSerializer depth, so the shape of each response is clear and stable.
"""

from rest_framework import serializers

from .models import Interview, Question, Report, ResearchProfile, Response, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email", "created_at"]


class ResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Response
        fields = ["id", "question_id", "answer", "score", "evaluation", "feedback", "created_at"]


class QuestionWithResponseSerializer(serializers.ModelSerializer):
    """Question with its associated response nested inline."""

    response = ResponseSerializer(read_only=True)

    class Meta:
        model = Question
        fields = [
            "id", "interview_id", "question", "section",
            "question_type", "order_index", "response",
        ]


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            "id", "interview_id", "question", "section",
            "question_type", "order_index",
        ]


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "interview_id", "overall_score", "report_json", "created_at"]


class InterviewListSerializer(serializers.ModelSerializer):
    """Compact representation used in list views."""

    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = Interview
        fields = [
            "id", "user_id", "user_name", "user_email",
            "company", "role", "difficulty", "status", "created_at",
        ]


class InterviewDetailSerializer(serializers.ModelSerializer):
    """Full interview with nested questions+responses and report."""

    user = UserSerializer(read_only=True)
    questions = QuestionWithResponseSerializer(many=True, read_only=True)
    report = ReportSerializer(read_only=True)

    class Meta:
        model = Interview
        fields = [
            "id", "user", "company", "role", "difficulty",
            "blueprint", "status", "created_at", "questions", "report",
        ]


class ResearchProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchProfile
        fields = [
            "id", "company", "role", "difficulty",
            "skills", "technologies", "topics", "rounds",
            "behavioral_patterns", "key_insights", "dsa_questions",
            "created_at", "updated_at",
        ]
