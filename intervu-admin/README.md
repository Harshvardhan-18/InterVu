# intervu-admin

An internal **admin and analytics companion** for the [InterVu](https://github.com/Harshvardhan-18/intervu)
AI mock-interview platform.

> **This service is completely read-only.**
> It does not modify, replace, or depend on the FastAPI backend being redeployed or changed
> in any way. It is a second, independent application that reads from the same database.

---

## What this is

InterVu's FastAPI backend runs live on an EC2 instance and handles all interview
sessions, AI agents, and user-facing APIs. This Django service is a **separate
companion app** that provides:

| Feature | Details |
|---|---|
| **Django Admin UI** | Browse users, interviews, questions, responses, and reports in a polished read-only interface at `/admin/` |
| **REST API** | `GET`-only DRF endpoints under `/api/` for analytics queries |
| **Research profiles** | Browse company/role intelligence profiles used by the InterVu agents |

---

## Architecture

```
EC2 (production)                     Your machine (local dev)
================                     ========================
FastAPI backend  <-- reads/writes --> PostgreSQL DB (intervu)
                                            ^
                                            | read-only role (future)
                                            |
                                     intervu-admin (Django)
                                     [ this repo ]
```

- **Does not** share a process, virtualenv, or codebase with the FastAPI backend.
- **Does not** run Django migrations against the InterVu database.
  All reflected models have `managed = False`.
- **Does not** expose any `POST`/`PUT`/`PATCH`/`DELETE` endpoints on InterVu data.
- All reads are routed through a dedicated `intervu` database connection
  (separate from Django's own `default` SQLite connection).

---

## Local development setup

### Prerequisites
- Python 3.11+
- Git

### 1. Clone and enter the repo

```bash
git clone <this-repo-url>
cd intervu-admin
```

### 2. Create and activate a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
# Edit .env:
#   - Set DJANGO_SECRET_KEY to any long random string
#   - Leave the INTERVU_DB_* vars commented out for local dev (SQLite is used)
```

### 5. Run Django migrations (Django's own tables only)

```bash
python manage.py migrate
```

This creates Django's built-in tables (auth, sessions, admin log) in a local
`db.sqlite3` file. **It does not touch any InterVu table.**

### 6. Load the development fixture

```bash
python manage.py loaddata analytics/fixtures/dev_seed.json --database=intervu
```

This seeds synthetic interview/evaluation data into the `intervu` database
connection (also SQLite locally) so you can browse the admin and test the API
without connecting to production.

### 7. Create a local admin superuser

```bash
python manage.py createsuperuser
# or use the values from .env:
python manage.py createsuperuser \
    --username admin \
    --email admin@example.com \
    --noinput
```

### 8. Start the development server

```bash
python manage.py runserver
```

Open:
- **Admin UI**: http://127.0.0.1:8000/admin/
- **API root**: http://127.0.0.1:8000/api/
- **JWT token**: POST http://127.0.0.1:8000/api/token/

---

## API endpoints

All endpoints require authentication (session cookie or JWT Bearer token).

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/users/` | List all users |
| `GET` | `/api/users/<id>/` | User detail |
| `GET` | `/api/users/<id>/interviews/` | Interviews for a user |
| `GET` | `/api/interviews/` | List all interviews (filterable) |
| `GET` | `/api/interviews/<id>/` | Full interview detail with questions |
| `GET` | `/api/interviews/<id>/evaluations/` | Questions + response scores |
| `GET` | `/api/interviews/<id>/report/` | Final evaluation report |
| `GET` | `/api/research-profiles/` | List research profiles |
| `GET` | `/api/research-profiles/<id>/` | Profile detail |

### Filtering examples

```bash
# All completed Google interviews
GET /api/interviews/?company=google&status=completed

# Interviews for a specific user email
GET /api/interviews/?user_email=alice@example.com

# Research profiles for hard-difficulty companies
GET /api/research-profiles/?difficulty=Hard

# Search across company/role names
GET /api/interviews/?search=backend
```

### Getting a JWT token

```bash
curl -X POST http://127.0.0.1:8000/api/token/ \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "<your-password>"}'
```

Then use the `access` token as a Bearer header:

```bash
curl http://127.0.0.1:8000/api/interviews/ \
     -H "Authorization: Bearer <access_token>"
```

---

## Connecting to the real database

> **Do not do this until a read-only Postgres role has been confirmed by the team.**

Once a `intervu_readonly` role exists, uncomment and fill in the `INTERVU_DB_*`
variables in your `.env`:

```env
INTERVU_DB_ENGINE=django.db.backends.postgresql
INTERVU_DB_NAME=intervu
INTERVU_DB_USER=intervu_readonly
INTERVU_DB_PASSWORD=<readonly-password>
INTERVU_DB_HOST=<ec2-host-or-rds-endpoint>
INTERVU_DB_PORT=5432
```

The `intervu` database connection is routed via `analytics/routers.py`.
Django will never run migrations against it (enforced in the router's
`allow_migrate` method and by `managed = False` on all reflected models).

---

## Project structure

```
intervu-admin/
|-- manage.py
|-- requirements.txt
|-- .env.example          # committed, no real secrets
|-- .env                  # gitignored
|-- .gitignore
|-- README.md
|-- intervu_admin/        # Django project package
|   |-- settings.py
|   |-- urls.py
|   `-- wsgi.py
`-- analytics/            # the only Django app
    |-- models.py         # reflected models (managed = False)
    |-- admin.py          # read-only admin registrations
    |-- serializers.py    # DRF serializers
    |-- views.py          # ReadOnlyModelViewSet viewsets
    |-- filters.py        # django-filter FilterSets
    |-- routers.py        # DB router (analytics -> intervu conn)
    |-- urls.py           # DRF router registration
    `-- fixtures/
        `-- dev_seed.json # synthetic data for local dev
```

---

## What this is NOT

- Not a replacement for the FastAPI backend.
- Not connected to LangChain, ChromaDB, or any AI agent.
- Not aware of or dependent on the FastAPI service being running.
- Not able to write to any InterVu table.
