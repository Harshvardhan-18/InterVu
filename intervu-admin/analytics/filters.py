"""
analytics/filters.py
---------------------
django-filter FilterSet classes used by the DRF viewsets.
"""

import django_filters

from .models import Interview, ResearchProfile


class InterviewFilter(django_filters.FilterSet):
    company = django_filters.CharFilter(lookup_expr="icontains")
    role = django_filters.CharFilter(lookup_expr="icontains")
    status = django_filters.ChoiceFilter(choices=Interview.STATUS_CHOICES)
    difficulty = django_filters.ChoiceFilter(choices=Interview.DIFFICULTY_CHOICES)
    created_after = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_before = django_filters.DateTimeFilter(field_name="created_at", lookup_expr="lte")
    user_email = django_filters.CharFilter(field_name="user__email", lookup_expr="icontains")

    class Meta:
        model = Interview
        fields = ["company", "role", "status", "difficulty"]


class ResearchProfileFilter(django_filters.FilterSet):
    company = django_filters.CharFilter(lookup_expr="icontains")
    role = django_filters.CharFilter(lookup_expr="icontains")
    difficulty = django_filters.CharFilter(lookup_expr="iexact")

    class Meta:
        model = ResearchProfile
        fields = ["company", "role", "difficulty"]
