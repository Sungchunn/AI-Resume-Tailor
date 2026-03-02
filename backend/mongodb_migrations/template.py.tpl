"""{description}."""

from motor.motor_asyncio import AsyncIOMotorDatabase

revision = "{revision}"
description = "{description}"
depends_on = {depends_on}


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
