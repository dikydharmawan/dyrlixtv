#!/usr/bin/env bash
#
# Update DYRLIX pada semua TV/STB (memakai argumen --update pada install-tv.sh).
#
# Pemakaian:
#   ./scripts/update-tv.sh [--apk /path/dyrlix.apk]
#
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/install-tv.sh" --update "$@"