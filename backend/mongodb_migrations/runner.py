"""MongoDB migration runner - core execution engine."""

import hashlib
import importlib.util
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Coroutine

from motor.motor_asyncio import AsyncIOMotorDatabase

MIGRATIONS_COLLECTION = "_migrations"
VERSIONS_DIR = Path(__file__).parent / "versions"


@dataclass
class Migration:
    """Represents a single migration file."""

    revision: str
    description: str
    depends_on: str | None
    filename: str
    checksum: str
    upgrade: Callable[[AsyncIOMotorDatabase], Coroutine[Any, Any, None]]
    downgrade: Callable[[AsyncIOMotorDatabase], Coroutine[Any, Any, None]]


@dataclass
class AppliedMigration:
    """Represents a migration record from the database."""

    revision: str
    applied_at: datetime
    checksum: str
    description: str


class MigrationError(Exception):
    """Raised when a migration fails."""

    pass


class MigrationRunner:
    """Handles migration discovery, execution, and tracking."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self._migrations: list[Migration] | None = None

    def _compute_checksum(self, filepath: Path) -> str:
        """Compute SHA256 checksum of a migration file."""
        content = filepath.read_bytes()
        return f"sha256:{hashlib.sha256(content).hexdigest()}"

    def _load_migration_file(self, filepath: Path) -> Migration:
        """Load a migration module from file path."""
        spec = importlib.util.spec_from_file_location(filepath.stem, filepath)
        if spec is None or spec.loader is None:
            raise MigrationError(f"Could not load migration: {filepath}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Validate required attributes
        required_attrs = ["revision", "description", "depends_on", "upgrade", "downgrade"]
        for attr in required_attrs:
            if not hasattr(module, attr):
                raise MigrationError(f"Migration {filepath.name} missing required attribute: {attr}")

        return Migration(
            revision=module.revision,
            description=module.description,
            depends_on=module.depends_on,
            filename=filepath.name,
            checksum=self._compute_checksum(filepath),
            upgrade=module.upgrade,
            downgrade=module.downgrade,
        )

    def discover_migrations(self) -> list[Migration]:
        """Discover all migration files in the versions directory."""
        if self._migrations is not None:
            return self._migrations

        migrations: list[Migration] = []

        if not VERSIONS_DIR.exists():
            return migrations

        for filepath in sorted(VERSIONS_DIR.glob("*.py")):
            if filepath.name.startswith("_"):
                continue

            migration = self._load_migration_file(filepath)
            migrations.append(migration)

        # Sort by revision
        migrations.sort(key=lambda m: m.revision)

        # Validate dependency chain
        self._validate_dependencies(migrations)

        self._migrations = migrations
        return migrations

    def _validate_dependencies(self, migrations: list[Migration]) -> None:
        """Validate that all migration dependencies exist and form a valid chain."""
        revisions = {m.revision for m in migrations}

        for migration in migrations:
            if migration.depends_on is not None and migration.depends_on not in revisions:
                raise MigrationError(
                    f"Migration {migration.revision} depends on {migration.depends_on} "
                    "which does not exist"
                )

    async def get_applied_migrations(self) -> list[AppliedMigration]:
        """Get list of all applied migrations from the database."""
        cursor = self.db[MIGRATIONS_COLLECTION].find().sort("_id", 1)
        applied: list[AppliedMigration] = []

        async for doc in cursor:
            applied.append(
                AppliedMigration(
                    revision=doc["_id"],
                    applied_at=doc["applied_at"],
                    checksum=doc["checksum"],
                    description=doc["description"],
                )
            )

        return applied

    async def get_pending_migrations(self) -> list[Migration]:
        """Get list of migrations that have not been applied."""
        all_migrations = self.discover_migrations()
        applied = await self.get_applied_migrations()
        applied_revisions = {m.revision for m in applied}

        return [m for m in all_migrations if m.revision not in applied_revisions]

    async def _record_migration(self, migration: Migration) -> None:
        """Record a migration as applied in the database."""
        await self.db[MIGRATIONS_COLLECTION].insert_one(
            {
                "_id": migration.revision,
                "applied_at": datetime.now(timezone.utc),
                "checksum": migration.checksum,
                "description": migration.description,
            }
        )

    async def _remove_migration_record(self, revision: str) -> None:
        """Remove a migration record from the database."""
        await self.db[MIGRATIONS_COLLECTION].delete_one({"_id": revision})

    async def upgrade(self, target_revision: str | None = None) -> list[str]:
        """
        Apply pending migrations up to the target revision.

        Args:
            target_revision: Stop after applying this revision. If None, apply all pending.

        Returns:
            List of applied revision IDs.

        Raises:
            MigrationError: If any migration fails.
        """
        pending = await self.get_pending_migrations()

        if not pending:
            return []

        applied_revisions: list[str] = []

        for migration in pending:
            try:
                await migration.upgrade(self.db)
                await self._record_migration(migration)
                applied_revisions.append(migration.revision)
            except Exception as e:
                raise MigrationError(
                    f"Failed to apply migration {migration.revision}: {e}"
                ) from e

            if target_revision and migration.revision == target_revision:
                break

        return applied_revisions

    async def downgrade(self, target_revision: str | None = None) -> list[str]:
        """
        Rollback applied migrations.

        Args:
            target_revision: Stop after rolling back to this revision (exclusive).
                           If None, rollback only the last migration.

        Returns:
            List of rolled back revision IDs.

        Raises:
            MigrationError: If any rollback fails.
        """
        applied = await self.get_applied_migrations()

        if not applied:
            return []

        all_migrations = self.discover_migrations()
        migration_map = {m.revision: m for m in all_migrations}

        # Determine which migrations to rollback
        to_rollback: list[AppliedMigration] = []

        if target_revision is None:
            # Rollback only the last migration
            to_rollback = [applied[-1]]
        else:
            # Rollback all migrations after target_revision
            found_target = False
            for applied_migration in reversed(applied):
                if applied_migration.revision == target_revision:
                    found_target = True
                    break
                to_rollback.append(applied_migration)

            if not found_target and target_revision:
                raise MigrationError(f"Target revision {target_revision} not found in applied migrations")

        rolled_back: list[str] = []

        for applied_migration in to_rollback:
            migration = migration_map.get(applied_migration.revision)
            if migration is None:
                raise MigrationError(
                    f"Migration file for {applied_migration.revision} not found"
                )

            try:
                await migration.downgrade(self.db)
                await self._remove_migration_record(applied_migration.revision)
                rolled_back.append(applied_migration.revision)
            except Exception as e:
                raise MigrationError(
                    f"Failed to rollback migration {applied_migration.revision}: {e}"
                ) from e

        return rolled_back

    async def check_checksums(self) -> list[tuple[str, str, str]]:
        """
        Check if any applied migrations have been modified.

        Returns:
            List of tuples (revision, expected_checksum, actual_checksum) for modified migrations.
        """
        applied = await self.get_applied_migrations()
        all_migrations = self.discover_migrations()
        migration_map = {m.revision: m for m in all_migrations}

        mismatches: list[tuple[str, str, str]] = []

        for applied_migration in applied:
            migration = migration_map.get(applied_migration.revision)
            if migration and migration.checksum != applied_migration.checksum:
                mismatches.append(
                    (applied_migration.revision, applied_migration.checksum, migration.checksum)
                )

        return mismatches
