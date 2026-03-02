"""Add New Index."""

from motor.motor_asyncio import AsyncIOMotorDatabase

revision = "20260302_0004"
description = "Add New Index"
depends_on = "20260302_0003"


async def upgrade(db: AsyncIOMotorDatabase) -> None:
    """Apply the migration."""
    # Add your upgrade logic here
    # Example: await db.collection.create_index("field_name")
    pass


async def downgrade(db: AsyncIOMotorDatabase) -> None:
    """Reverse the migration."""
    # Add your downgrade logic here
    # Example: await db.collection.drop_index("field_name_1")
    pass
