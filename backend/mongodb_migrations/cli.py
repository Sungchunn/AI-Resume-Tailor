"""MongoDB migrations CLI."""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from mongodb_migrations.runner import MigrationError, MigrationRunner

TEMPLATE_PATH = Path(__file__).parent / "template.py.tpl"
VERSIONS_DIR = Path(__file__).parent / "versions"


def get_settings() -> tuple[str, str]:
    """Load MongoDB settings from app config."""
    # Import here to avoid circular imports and allow CLI to work standalone
    from app.core.config import get_settings

    settings = get_settings()
    return settings.mongodb_uri, settings.mongodb_database


async def get_runner() -> MigrationRunner:
    """Create a migration runner with database connection."""
    uri, database = get_settings()
    client = AsyncIOMotorClient(uri)
    db = client[database]
    return MigrationRunner(db)


def cmd_status(args: argparse.Namespace) -> int:
    """Show migration status."""

    async def _status() -> int:
        runner = await get_runner()

        all_migrations = runner.discover_migrations()
        applied = await runner.get_applied_migrations()
        applied_revisions = {m.revision for m in applied}

        print("\nMongoDB Migrations Status")
        print("=" * 60)

        if not all_migrations:
            print("No migrations found.")
            return 0

        # Check for checksum mismatches
        mismatches = await runner.check_checksums()
        if mismatches:
            print("\nWARNING: Modified migrations detected!")
            for revision, expected, actual in mismatches:
                print(f"  - {revision}: checksum changed")
            print()

        print(f"{'Revision':<25} {'Status':<12} {'Description'}")
        print("-" * 60)

        for migration in all_migrations:
            if migration.revision in applied_revisions:
                status = "applied"
            else:
                status = "pending"

            desc = migration.description[:30] + "..." if len(migration.description) > 30 else migration.description
            print(f"{migration.revision:<25} {status:<12} {desc}")

        pending_count = len(all_migrations) - len(applied_revisions)
        print("-" * 60)
        print(f"Total: {len(all_migrations)} migrations, {len(applied_revisions)} applied, {pending_count} pending")

        return 0

    return asyncio.run(_status())


def cmd_upgrade(args: argparse.Namespace) -> int:
    """Apply pending migrations."""

    async def _upgrade() -> int:
        runner = await get_runner()

        # Check for checksum mismatches first
        mismatches = await runner.check_checksums()
        if mismatches:
            print("ERROR: Cannot upgrade - modified migrations detected:")
            for revision, expected, actual in mismatches:
                print(f"  - {revision}: checksum changed")
            print("\nPlease restore the original migration files or manually resolve.")
            return 1

        target = args.revision if hasattr(args, "revision") and args.revision else None

        pending = await runner.get_pending_migrations()
        if not pending:
            print("No pending migrations.")
            return 0

        print(f"Applying {len(pending)} migration(s)...")

        try:
            applied = await runner.upgrade(target)
            for revision in applied:
                print(f"  Applied: {revision}")
            print(f"\nSuccessfully applied {len(applied)} migration(s).")
            return 0
        except MigrationError as e:
            print(f"\nERROR: {e}")
            return 1

    return asyncio.run(_upgrade())


def cmd_downgrade(args: argparse.Namespace) -> int:
    """Rollback migrations."""

    async def _downgrade() -> int:
        runner = await get_runner()

        applied = await runner.get_applied_migrations()
        if not applied:
            print("No migrations to rollback.")
            return 0

        target = args.revision if hasattr(args, "revision") and args.revision else None

        if target is None:
            print(f"Rolling back last migration: {applied[-1].revision}")
        else:
            print(f"Rolling back to revision: {target}")

        try:
            rolled_back = await runner.downgrade(target)
            for revision in rolled_back:
                print(f"  Rolled back: {revision}")
            print(f"\nSuccessfully rolled back {len(rolled_back)} migration(s).")
            return 0
        except MigrationError as e:
            print(f"\nERROR: {e}")
            return 1

    return asyncio.run(_downgrade())


def cmd_create(args: argparse.Namespace) -> int:
    """Create a new migration file."""
    name = args.name.lower().replace(" ", "_").replace("-", "_")

    # Generate revision ID
    now = datetime.now(timezone.utc)
    date_prefix = now.strftime("%Y%m%d")

    # Find the next sequence number for today
    existing = list(VERSIONS_DIR.glob(f"{date_prefix}_*.py"))
    if existing:
        # Extract sequence numbers and find max
        seq_numbers = []
        for f in existing:
            parts = f.stem.split("_")
            if len(parts) >= 2:
                try:
                    seq_numbers.append(int(parts[1]))
                except ValueError:
                    pass
        next_seq = max(seq_numbers, default=0) + 1
    else:
        next_seq = 1

    revision = f"{date_prefix}_{next_seq:04d}"
    filename = f"{revision}_{name}.py"
    filepath = VERSIONS_DIR / filename

    # Find the previous migration for depends_on
    all_files = sorted(VERSIONS_DIR.glob("*.py"))
    all_files = [f for f in all_files if not f.name.startswith("_")]

    depends_on = "None"
    if all_files:
        # Get revision from last migration
        last_file = all_files[-1]
        parts = last_file.stem.split("_")
        if len(parts) >= 2:
            depends_on = f'"{parts[0]}_{parts[1]}"'

    # Load template
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: Template file not found: {TEMPLATE_PATH}")
        return 1

    template = TEMPLATE_PATH.read_text()

    # Generate description from name
    description = name.replace("_", " ").title()

    content = template.format(
        revision=revision,
        description=description,
        depends_on=depends_on,
    )

    filepath.write_text(content)
    print(f"Created migration: {filename}")
    print(f"  Path: {filepath}")

    return 0


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="mongodb_migrations",
        description="MongoDB migration management CLI",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # status command
    status_parser = subparsers.add_parser("status", help="Show migration status")
    status_parser.set_defaults(func=cmd_status)

    # upgrade command
    upgrade_parser = subparsers.add_parser("upgrade", help="Apply pending migrations")
    upgrade_parser.add_argument(
        "revision",
        nargs="?",
        help="Stop after applying this revision (optional)",
    )
    upgrade_parser.set_defaults(func=cmd_upgrade)

    # downgrade command
    downgrade_parser = subparsers.add_parser("downgrade", help="Rollback migrations")
    downgrade_parser.add_argument(
        "revision",
        nargs="?",
        help="Rollback to this revision (exclusive). If omitted, rollback last only.",
    )
    downgrade_parser.set_defaults(func=cmd_downgrade)

    # create command
    create_parser = subparsers.add_parser("create", help="Create a new migration")
    create_parser.add_argument("name", help="Migration name (e.g., 'add_ats_score_index')")
    create_parser.set_defaults(func=cmd_create)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
