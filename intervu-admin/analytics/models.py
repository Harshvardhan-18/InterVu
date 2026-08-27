"""
analytics/models.py

Read-only Django ORM models mirroring the InterVu FastAPI schema.

CRITICAL: Every model has ``class Meta: managed = False``.
Django will never create, alter, or drop these tables.
Schema authority belongs exclusively to the FastAPI backend / Alembic.

Source: backend/db/postgres.py
Tables: users, interviews, questions, responses, reports, research_profiles
"""

import json

from django.db import models


class RobustJSONField(models.JSONField):
    """
    JSONField that safely handles psycopg2's native JSON auto-decoding.

    psycopg2 automatically deserializes Postgres JSON/JSONB columns into
    Python dicts/lists before Django sees the value. Django's JSONField
    then calls json.loads() on the result, which raises:
        TypeError: the JSON object must be str, bytes or bytearray, not dict

    This subclass checks the type in from_db_value() and skips decoding
    if the value is already a Python object (dict or list).
    """

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        # Already decoded by psycopg2 — return as-is
        if isinstance(value, (dict, list)):
            return value
        # Raw string — let the parent handle decoding
        return super().from_db_value(value, expression, connection)



class User(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}>"


class Interview(models.Model):
    STATUS_CHOICES = [("in_progress", "In Progress"), ("completed", "Completed")]
    DIFFICULTY_CHOICES = [("easy", "Easy"), ("medium", "Medium"), ("hard", "Hard")]

    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="interviews",
    )
    company = models.CharField(max_length=255)
    role = models.CharField(max_length=255)
    difficulty = models.CharField(max_length=50, choices=DIFFICULTY_CHOICES, default="medium")
    blueprint = RobustJSONField(null=True, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="in_progress")
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "interviews"
        verbose_name = "Interview"
        verbose_name_plural = "Interviews"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.id}] {self.company} - {self.role} ({self.status})"


class Question(models.Model):
    id = models.AutoField(primary_key=True)
    interview = models.ForeignKey(
        Interview,
        on_delete=models.DO_NOTHING,
        db_column="interview_id",
        related_name="questions",
    )
    question = models.TextField()
    section = models.CharField(max_length=100, null=True, blank=True)
    question_type = models.CharField(max_length=100, null=True, blank=True)
    order_index = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = "questions"
        verbose_name = "Question"
        verbose_name_plural = "Questions"
        ordering = ["interview_id", "order_index"]

    def __str__(self):
        return f"Q{self.order_index}: {self.question[:80]}"


class Response(models.Model):
    id = models.AutoField(primary_key=True)
    question = models.OneToOneField(
        Question,
        on_delete=models.DO_NOTHING,
        db_column="question_id",
        related_name="response",
    )
    answer = models.TextField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)
    evaluation = RobustJSONField(null=True, blank=True)
    feedback = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "responses"
        verbose_name = "Response"
        verbose_name_plural = "Responses"
        ordering = ["-created_at"]

    def __str__(self):
        score_str = f"{self.score:.1f}" if self.score is not None else "unscored"
        return f"Response for Q{self.question_id} ({score_str})"


class Report(models.Model):
    id = models.AutoField(primary_key=True)
    interview = models.OneToOneField(
        Interview,
        on_delete=models.DO_NOTHING,
        db_column="interview_id",
        related_name="report",
    )
    overall_score = models.FloatField(null=True, blank=True)
    report_json = RobustJSONField(null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "reports"
        verbose_name = "Report"
        verbose_name_plural = "Reports"
        ordering = ["-created_at"]

    def __str__(self):
        score_str = f"{self.overall_score:.1f}" if self.overall_score is not None else "N/A"
        return f"Report for Interview {self.interview_id} (score: {score_str})"


class ResearchProfile(models.Model):
    id = models.AutoField(primary_key=True)
    company = models.CharField(max_length=255)
    role = models.CharField(max_length=255)
    skills = RobustJSONField(default=list)
    technologies = RobustJSONField(default=list)
    topics = RobustJSONField(default=list)
    rounds = RobustJSONField(default=list)
    behavioral_patterns = RobustJSONField(default=list)
    key_insights = RobustJSONField(default=list)
    dsa_questions = RobustJSONField(default=list)
    difficulty = models.CharField(max_length=50, default="Medium")
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "research_profiles"
        verbose_name = "Research Profile"
        verbose_name_plural = "Research Profiles"
        unique_together = [("company", "role")]
        ordering = ["company", "role"]

    def __str__(self):
        return f"{self.company} - {self.role}"
