"""
analytics/admin.py
───────────────────
Read-only Django admin registrations for all reflected InterVu models.

Every ModelAdmin here overrides:
  has_add_permission    → False
  has_change_permission → False
  has_delete_permission → False

This makes the admin UI a pure read-only browsing interface, regardless of
whether the underlying DB connection is read-only at the Postgres level.
"""

from django.contrib import admin

from .models import Interview, Question, Report, ResearchProfile, Response, User


# ── Helpers ────────────────────────────────────────────────────────────────────

class ReadOnlyAdminMixin:
    """Mixin that disables all write operations in the Django admin."""

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# ── Inline admins ──────────────────────────────────────────────────────────────

class QuestionInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = Question
    extra = 0
    fields = ("order_index", "section", "question_type", "question")
    readonly_fields = ("order_index", "section", "question_type", "question")
    show_change_link = True


class ResponseInline(ReadOnlyAdminMixin, admin.TabularInline):
    model = Response
    extra = 0
    fields = ("score", "feedback", "created_at")
    readonly_fields = ("score", "feedback", "created_at")


class ReportInline(ReadOnlyAdminMixin, admin.StackedInline):
    model = Report
    extra = 0
    fields = ("overall_score", "report_json", "created_at")
    readonly_fields = ("overall_score", "report_json", "created_at")


# ── Model admins ───────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "email", "created_at", "interview_count")
    search_fields = ("name", "email")
    readonly_fields = ("id", "name", "email", "created_at")
    ordering = ("-created_at",)

    def interview_count(self, obj):
        return obj.interviews.count()
    interview_count.short_description = "Interviews"


@admin.register(Interview)
class InterviewAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = (
        "id", "user", "company", "role", "difficulty", "status", "created_at",
    )
    list_filter = ("status", "difficulty", "company")
    search_fields = ("company", "role", "user__email", "user__name")
    readonly_fields = (
        "id", "user", "company", "role", "difficulty",
        "blueprint", "status", "created_at",
    )
    ordering = ("-created_at",)
    inlines = [QuestionInline, ReportInline]


@admin.register(Question)
class QuestionAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "interview", "section", "question_type", "order_index", "short_question")
    list_filter = ("section", "question_type")
    search_fields = ("question", "interview__company", "interview__role")
    readonly_fields = ("id", "interview", "question", "section", "question_type", "order_index")
    ordering = ("interview_id", "order_index")
    inlines = [ResponseInline]

    def short_question(self, obj):
        return obj.question[:100] + ("…" if len(obj.question) > 100 else "")
    short_question.short_description = "Question"


@admin.register(Response)
class ResponseAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "question", "score", "created_at")
    list_filter = ("score",)
    search_fields = ("answer", "feedback", "question__question")
    readonly_fields = ("id", "question", "answer", "score", "evaluation", "feedback", "created_at")
    ordering = ("-created_at",)


@admin.register(Report)
class ReportAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "interview", "overall_score", "created_at")
    search_fields = ("interview__company", "interview__role")
    readonly_fields = ("id", "interview", "overall_score", "report_json", "created_at")
    ordering = ("-created_at",)


@admin.register(ResearchProfile)
class ResearchProfileAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "company", "role", "difficulty", "created_at", "updated_at")
    list_filter = ("difficulty",)
    search_fields = ("company", "role")
    readonly_fields = (
        "id", "company", "role", "skills", "technologies", "topics",
        "rounds", "behavioral_patterns", "key_insights", "dsa_questions",
        "difficulty", "created_at", "updated_at",
    )
    ordering = ("company", "role")
