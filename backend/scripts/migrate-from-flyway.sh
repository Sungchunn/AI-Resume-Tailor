#!/bin/bash
# migrate-from-flyway.sh
#
# Script for migrating existing Flyway-managed databases to Alembic.
# This stamps the baseline as applied (without running it) and then
# runs any remaining migrations.
#
# Usage:
#   cd backend
#   ./scripts/migrate-from-flyway.sh
#
# Prerequisites:
#   - Database has been migrated by Flyway (V1-V5 applied)
#   - psycopg2-binary installed (poetry install)
#   - DATABASE_URL or DATABASE_URL_SYNC environment variable set

set -e

echo "=== Flyway to Alembic Migration ==="
echo ""

# Check if we're in the right directory
if [ ! -f "alembic.ini" ]; then
    echo "Error: alembic.ini not found. Please run this script from the backend directory."
    exit 1
fi

# Check current state
echo "1. Checking current migration state..."
if alembic current 2>/dev/null | grep -q "000"; then
    echo "   Baseline (000) is already applied. Skipping stamp."
else
    echo "   Stamping baseline as applied (without running it)..."
    alembic stamp 000
fi

# Run remaining migrations
echo ""
echo "2. Running remaining migrations..."
alembic upgrade head

# Verify
echo ""
echo "3. Verifying migration state..."
alembic current

echo ""
echo "=== Migration complete ==="
echo ""
echo "Optional: You can now drop the flyway_schema_history table if desired:"
echo "  DROP TABLE IF EXISTS flyway_schema_history;"
