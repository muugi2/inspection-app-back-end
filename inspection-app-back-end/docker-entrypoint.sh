#!/bin/sh
set -e

# Create uploads directory if it doesn't exist
# Note: Volume mount from docker-compose.yml will handle this
# This is just a fallback
if [ ! -d "/app/uploads" ]; then
  echo "⚠️ Warning: /app/uploads directory does not exist!"
  echo "   Make sure volume mount is working correctly in docker-compose.yml"
fi

echo "✅ Starting application..."
echo "   FTP_STORAGE_PATH: ${FTP_STORAGE_PATH:-/app/uploads}"
echo "   FTP_BASE_URL: ${FTP_BASE_URL:-not set}"
echo "   FTP_REMOTE_PREFIX: ${FTP_REMOTE_PREFIX:-test}"

exec "$@"

