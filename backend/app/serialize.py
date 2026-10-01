"""Convert SQLAlchemy model instances to JSON-safe dicts."""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from sqlalchemy.orm import RelationshipProperty
from sqlalchemy import inspect as sa_inspect


def row_to_dict(obj, rels: set[str] | None = None) -> dict:
    """Serialize a SQLAlchemy model to a dict, optionally including loaded relationships.

    Args:
        obj: SQLAlchemy model instance
        rels: set of relationship attribute names to include (None = include all loaded)
    """
    if obj is None:
        return None

    mapper = sa_inspect(type(obj))
    result = {}

    for col in mapper.columns:
        val = getattr(obj, col.key)
        if isinstance(val, Decimal):
            val = float(val)
        elif isinstance(val, datetime):
            val = val.isoformat()
        elif isinstance(val, date):
            val = val.isoformat()
        elif isinstance(val, Enum):
            val = val.value
        result[col.key] = val

    for rel_prop in mapper.relationships:
        name = rel_prop.key
        if rels is not None and name not in rels:
            continue
        if not _is_loaded(obj, name):
            continue
        val = getattr(obj, name)
        if val is None:
            result[name] = None
        elif isinstance(val, list):
            result[name] = [row_to_dict(item) for item in val]
        else:
            result[name] = row_to_dict(val)

    return result


def _is_loaded(obj, attr_name: str) -> bool:
    state = sa_inspect(obj)
    return attr_name not in state.unloaded
