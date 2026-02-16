#!/bin/bash
# Generate TypeScript client from FastAPI OpenAPI spec

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
OUTPUT_DIR="$FRONTEND_DIR/src/lib/api"

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
OPENAPI_URL="$BACKEND_URL/openapi.json"

echo "Fetching OpenAPI spec from $OPENAPI_URL..."

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Check if backend is running
if ! curl -s "$OPENAPI_URL" > /dev/null 2>&1; then
    echo "Error: Backend is not running at $BACKEND_URL"
    echo "Start the backend first: docker-compose up -d backend"
    exit 1
fi

# Generate TypeScript client using openapi-typescript
cd "$FRONTEND_DIR"

# Install openapi-typescript if not present
if ! bun pm ls | grep -q "openapi-typescript"; then
    echo "Installing openapi-typescript..."
    bun add -d openapi-typescript
fi

# Generate types
echo "Generating TypeScript types..."
bunx openapi-typescript "$OPENAPI_URL" -o "$OUTPUT_DIR/schema.d.ts"

echo "TypeScript client generated at $OUTPUT_DIR/schema.d.ts"
