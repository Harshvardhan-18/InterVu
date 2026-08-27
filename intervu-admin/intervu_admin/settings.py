"""
intervu_admin/settings.py
─────────────────────────
Django settings for the InterVu Admin companion service.

Key design decisions
────────────────────
• Two database connections are configured:
    - 'default'  → SQLite, used by Django's own tables (auth, sessions, admin
                   log, and any future intervu-admin-specific tables).
    - 'intervu'  → points at the InterVu Postgres DB when INTERVU_DB_* env vars
                   are populated; falls back to SQLite so local dev works with
                   no external DB at all.

• The 'analytics' app's unmanaged (read-only) models are routed to the
  'intervu' connection via analytics/routers.py.

• DEBUG defaults to True for local development. Set DJANGO_DEBUG=False in
  production.
"""

from pathlib import Path

from decouple import Csv, config

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent.parent


# ── Core ───────────────────────────────────────────────────────────────────────

SECRET_KEY = config("DJANGO_SECRET_KEY", default="dev-insecure-secret-key-change-me")

DEBUG = config("DJANGO_DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)


# ── Installed apps ─────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    # Django built-ins
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # Local
    "analytics",
]


# ── Middleware ─────────────────────────────────────────────────────────────────

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ── URLs ───────────────────────────────────────────────────────────────────────

ROOT_URLCONF = "intervu_admin.urls"


# ── Templates ──────────────────────────────────────────────────────────────────

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ── WSGI ───────────────────────────────────────────────────────────────────────

WSGI_APPLICATION = "intervu_admin.wsgi.application"


# ── Databases ──────────────────────────────────────────────────────────────────
#
# 'default'  — Django's own tables (auth, sessions, admin log, etc.)
#              Uses SQLite locally so the service runs with zero external deps.
#
# 'intervu'  — InterVu's existing tables, read-only reflected models.
#              Falls back to the same SQLite file when the env vars are absent,
#              meaning the dev fixture is always usable without a Postgres server.

_intervu_db_engine = config("INTERVU_DB_ENGINE", default="")
_intervu_db_name = config("INTERVU_DB_NAME", default="")

if _intervu_db_engine and _intervu_db_name:
    _intervu_db = {
        "ENGINE": _intervu_db_engine,
        "NAME": _intervu_db_name,
        "USER": config("INTERVU_DB_USER", default=""),
        "PASSWORD": config("INTERVU_DB_PASSWORD", default=""),
        "HOST": config("INTERVU_DB_HOST", default="localhost"),
        "PORT": config("INTERVU_DB_PORT", default="5432"),
    }
else:
    # Local dev: use the same SQLite file — the fixture seeds synthetic data.
    _intervu_db = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    },
    "intervu": _intervu_db,
}

# Route unmanaged InterVu models to the 'intervu' connection.
DATABASE_ROUTERS = ["analytics.routers.IntervuRouter"]


# ── Auth ───────────────────────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ── Internationalisation ───────────────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ── Static files ───────────────────────────────────────────────────────────────

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


# ── Default PK ─────────────────────────────────────────────────────────────────

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ── Django REST Framework ──────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAdminUser",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}


# ── CORS (restrict to localhost in development) ────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
