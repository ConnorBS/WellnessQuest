#!/usr/bin/env bash
# Nightly WellnessQuest Postgres backup.
# Retention: keep 14 daily + 8 weekly.
set -euo pipefail

OUT_DIR="${BACKUP_DIR:-/backups}"
STAMP="$(date -u +%Y%m%d-%H%M)"
DOW="$(date -u +%u)"  # 1..7, Monday=1
mkdir -p "${OUT_DIR}"

FILE="${OUT_DIR}/wq-${STAMP}.dump.gz"
echo "[backup] writing ${FILE}"

# `-Fc` = custom format (compressed by default). We additionally gzip for transport.
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-wq}" \
  -d "${POSTGRES_DB:-wellnessquest}" \
  -Fc \
  | gzip -9 > "${FILE}"

# Weekly snapshot on Sunday (DOW=7)
if [ "${DOW}" = "7" ]; then
  cp "${FILE}" "${OUT_DIR}/wq-weekly-${STAMP}.dump.gz"
fi

echo "[backup] retention sweep"
ls -1t "${OUT_DIR}"/wq-2*.dump.gz 2>/dev/null | tail -n +15 | xargs -r rm -v --
ls -1t "${OUT_DIR}"/wq-weekly-*.dump.gz 2>/dev/null | tail -n +9 | xargs -r rm -v --

echo "[backup] done"
