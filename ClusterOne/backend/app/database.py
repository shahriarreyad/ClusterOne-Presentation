from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def add_missing_columns(bind) -> list:
    """Add nullable columns that models gained after a database was first created.

    create_all() never alters existing tables, so older databases (including the
    dev SQLite file) are upgraded in place. Returns the "table.column" names added.
    """
    added = []
    insp = inspect(bind)
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        existing = {c["name"] for c in insp.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing:
                continue
            ddl_type = col.type.compile(dialect=bind.dialect)
            with bind.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {ddl_type}'))
            added.append(f"{table.name}.{col.name}")
    return added


def init_db():
    from app import models  # noqa: F401  (register models on Base)

    Base.metadata.create_all(bind=engine)
    add_missing_columns(engine)
