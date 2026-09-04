#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?target copy is required}"
BACKUP="${TARGET}.rollback-backup"
WORK="${TARGET}.rollback-work"
cp "$TARGET" "$BACKUP"
printf '\nrollback-test-marker\n' >> "$WORK"
cp "$BACKUP" "$WORK"
if cmp -s "$WORK" "$BACKUP"; then
  printf 'ROLLBACK_OK\n'
else
  printf 'ROLLBACK_FAILED\n' >&2
  exit 1
fi
