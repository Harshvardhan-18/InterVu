
"""
analytics/management/commands/setup_dev_db.py
----------------------------------------------
One-time dev setup:  python manage.py setup_dev_db

What it does (LOCAL DEV ONLY -- SQLite intervu connection):
  1. Creates the InterVu mirror tables in the local SQLite dev DB so the
     fixture can be loaded (managed=False means normal migrate skips them).
  2. Inserts records from analytics/fixtures/dev_seed.json directly via the
     ORM (bypassing loaddata routing quirks in dev).

This command is a no-op (skips table creation) when the intervu connection
is Postgres -- the real tables already exist there.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = (
        "LOCAL DEV ONLY: create InterVu mirror tables in the SQLite dev DB "
        "and load the dev fixture."
    )

    def handle(self, *args, **options):
        db_conn = connections["intervu"]
        vendor = db_conn.vendor

        if vendor != "sqlite":
            self.stdout.write(
                self.style.WARNING(
                    f"'intervu' connection is {vendor}, not SQLite -- "
                    "skipping dev table creation. The real tables already "
                    "exist in Postgres. Run the server directly."
                )
            )
            return

        from analytics.models import (
            Interview,
            Question,
            Report,
            ResearchProfile,
            Response,
            User,
        )

        # Step 1: create tables
        self.stdout.write("Creating InterVu mirror tables in local SQLite dev DB...")
        with db_conn.schema_editor() as editor:
            for model in [User, Interview, Question, Response, Report, ResearchProfile]:
                try:
                    editor.create_model(model)
                    self.stdout.write(f"  + {model._meta.db_table}")
                except Exception as exc:
                    self.stdout.write(
                        self.style.WARNING(f"  ~ {model._meta.db_table} already exists, skipping")
                    )

        # Step 2: load fixture via direct ORM insert
        fixture_path = (
            Path(__file__).resolve().parents[3]
            / "analytics" / "fixtures" / "dev_seed.json"
        )
        self.stdout.write(f"Loading fixture: {fixture_path.name}...")

        with open(fixture_path, encoding="utf-8") as f:
            records = json.load(f)

        model_map = {
            "analytics.user": User,
            "analytics.interview": Interview,
            "analytics.question": Question,
            "analytics.response": Response,
            "analytics.report": Report,
            "analytics.researchprofile": ResearchProfile,
        }

        inserted = 0
        skipped = 0
        for entry in records:
            model_cls = model_map.get(entry["model"])
            if not model_cls:
                self.stdout.write(self.style.WARNING(f"Unknown model: {entry['model']}"))
                continue
            obj = model_cls(pk=entry["pk"], **entry["fields"])
            try:
                obj.save(using="intervu")
                inserted += 1
            except Exception as exc:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(f"  ~ Skipped pk={entry['pk']}: {exc}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Inserted {inserted}, skipped {skipped}. Dev DB is ready."
            )
        )
