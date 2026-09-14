#!/bin/sh
set -e

# ChurchFlow Database Restore Script
if [ -z "$1" ] && [ -z "$DB_BACKUP_FILE" ]; then
  echo "Usage: ./restore-db.sh <path_to_backup.sql.gz>"
  echo "Example: ./restore-db.sh /jarvis/code/servesync/backups/churchflow_backup_latest.sql.gz"
  exit 1
fi

BACKUP_FILE="${1:-$DB_BACKUP_FILE}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️ Restoring ChurchFlow database from: $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | docker-compose exec -T db psql -U "${DB_USER:-servesync}" -d "${DB_NAME:-servesync}"

echo "✅ Database restored successfully from backup!"
