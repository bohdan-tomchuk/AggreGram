#!/bin/sh
set -e

echo "Running database migrations..."
pnpm typeorm migration:run -d dist/src/database/data-source.js

echo "Starting application..."
node dist/src/main.js
