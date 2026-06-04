from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import ResearchProfile

async def get_research_profile(
        db: AsyncSession,
        company: str,
        role: str
):
    result = await db.execute(
        select(ResearchProfile).where(
            ResearchProfile.company == company,
            ResearchProfile.role == role
        )
    )
    return result.scalar_one_or_none()

async def save_research_profile(
        db: AsyncSession,
        company: str,
        role: str,
        extracted: dict
):
    try:
        profile=ResearchProfile(
            company=company,
            role=role,
            **extracted
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        return profile
    except Exception as e:
        await db.rollback()
        raise e