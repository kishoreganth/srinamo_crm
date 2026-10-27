from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import Feedback
from app.serialize import row_to_dict

router = APIRouter(tags=["Feedback"])


@router.get("/api/feedback")
async def list_feedback(
    maxScore: int = Query(3, ge=1, le=5),
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Feedback).where(Feedback.score.is_not(None), Feedback.score <= maxScore).order_by(Feedback.createdAt.desc()).limit(50)
    )).scalars().all()
    return [row_to_dict(row) for row in rows]
