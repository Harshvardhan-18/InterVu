"""
analytics/routers.py
---------------------
Database router that sends all read-only InterVu models to the "intervu"
database connection, while keeping Django own tables on "default".

Rules:
  - Analytics app models  -> "intervu" DB (read-only, managed=False)
  - All other models      -> "default" DB (SQLite, Django own tables)
  - allow_migrate: returns None for analytics app (defers to Django default
    logic so loaddata can seed the local SQLite dev fixture), and blocks
    real Django framework migrations from ever running on the intervu DB.
"""

ANALYTICS_APP = "analytics"


class IntervuRouter:
    """Route analytics models to the read-only intervu database."""

    def db_for_read(self, model, **hints):
        if model._meta.app_label == ANALYTICS_APP:
            return "intervu"
        return "default"

    def db_for_write(self, model, **hints):
        if model._meta.app_label == ANALYTICS_APP:
            return "intervu"
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        db_set = {"intervu", "default"}
        if obj1._state.db in db_set and obj2._state.db in db_set:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        # Analytics models are managed=False -- Django will never generate
        # migration files for them. Returning None defers to Django default
        # logic so loaddata can still seed the local SQLite dev fixture.
        if app_label == ANALYTICS_APP:
            return None
        # Never run Django framework migrations on the intervu DB.
        if db == "intervu":
            return False
        # Django built-in apps migrate on "default" only.
        return db == "default"
