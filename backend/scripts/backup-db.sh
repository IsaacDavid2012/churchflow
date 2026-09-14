#!/bin/sh
set -e

# ChurchFlow Automated Database Backup Script
BACKUP_DIR="${BACKUP_DIR:-/jarvis/code/servesync/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/churchflow_backup_${TIMESTAMP}.sql.gz"

echo "📦 Creating ChurchFlow PostgreSQL database backup: $BACKUP_FILE"
docker-compose exec -T db pg_dump -U "${DB_USER:-servesync}" -d "${DB_NAME:-servesync}" --clean --if-exists | gzip > "$BACKUP_FILE"

echo "✅ Backup created successfully: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "💡 To restore: DB_BACKUP_FILE=$BACKUP_FILE ./scripts/restore-db.sh"
