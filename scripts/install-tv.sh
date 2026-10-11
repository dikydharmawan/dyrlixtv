#!/usr/bin/env bash
#
# Install/update DYRLIX ke semua TV/STB dari jaringan mana pun (lewat Tailscale).
# Membaca daftar perangkat dari tv-hosts.txt, lalu per perangkat:
#   adb connect  ->  adb install [--update: -r -d]  ->  verifikasi package.
#
# Pemakaian:
#   ./scripts/install-tv.sh                 # install pertama (gagal jika versi lebih rendah)
#   ./scripts/install-tv.sh --update        # update (ganti versi yang sudah terpasang)
#   ./scripts/install-tv.sh --apk /path/dyrlix.apk
#
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HOSTS_FILE="${TV_HOSTS_FILE:-$PROJECT_ROOT/tv-hosts.txt}"
APK_PATH="$PROJECT_ROOT/dyrlix.apk"
ADB_PORT=5555
MODE="install"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update)
      MODE="update"
      shift
      ;;
    --apk)
      APK_PATH="${2:??argumen --apk butuh path}"
      shift 2
      ;;
    *)
      echo "Argumen tak dikenal: $1" >&2
      echo "Pemakaian: $0 [--update] [--apk <path.apk>]" >&2
      exit 2
      ;;
  esac
done

[[ -f "$APK_PATH" ]] || { echo "APK tidak ditemukan: $APK_PATH" >&2; exit 1; }
[[ -f "$HOSTS_FILE" ]] || { echo "File perangkat tidak ditemukan: $HOSTS_FILE" >&2; exit 1; }
command -v adb >/dev/null 2>&1 || { echo "adb tidak ada di PATH (install platform-tools)." >&2; exit 1; }

mapfile -t LINES < <(grep -v '^\s*#' "$HOSTS_FILE" | grep -v '^\s*$')
[[ ${#LINES[@]} -gt 0 ]] || { echo "tv-hosts.txt tidak berisi perangkat." >&2; exit 1; }

echo ">> Mode: $MODE"
echo ">> APK : $APK_PATH ($(du -h "$APK_PATH" 2>/dev/null | cut -f1))"
echo ">> Device: ${#LINES[@]}"

declare -a ONLINE=( ) FAILED_DEVICES=( )
OK=0; FAIL=0

for RAW in "${LINES[@]}"; do
  RAW="${RAW%%#*}"
  [[ -n "$RAW" ]] || continue
  IP="${RAW%%:*}"
  PORT="${RAW##*:}"
  [[ "$PORT" =~ ^[0-9]+$ && "$RAW" == *":"* ]] || PORT="$ADB_PORT"

  printf '>> %s:%s ' "$IP" "$PORT"
  if ! adb connect "$IP:$PORT" 2>&1 | grep -qi "connected"; then
    echo "GAGAL connect"
    FAIL=$((FAIL+1)); FAILED_DEVICES+=("$IP")
    continue
  fi

  if [[ "$MODE" == "update" ]]; then
    RES="$(adb -s "$IP:$PORT" install -r -d "$APK_PATH" 2>&1)"
  else
    RES="$(adb -s "$IP:$PORT" install -r "$APK_PATH" 2>&1)"
  fi

  if echo "$RES" | grep -q "Success"; then
    PKG="$(adb -s "$IP:$PORT" shell pm path com.dyrlix.player 2>&1 | tr -d '\r')"
    if echo "$PKG" | grep -q "package:"; then
      echo "OK (terverifikasi)"
      ONLINE+=("$IP")
      OK=$((OK+1))
    else
      echo "OK install, tapi verifikasi package gagal"
      FAIL=$((FAIL+1)); FAILED_DEVICES+=("$IP")
    fi
  else
    echo "GAGAL install: $(echo "$RES" | grep -i 'failure\|error' | tail -1)"
    FAIL=$((FAIL+1)); FAILED_DEVICES+=("$IP")
  fi
done

echo
echo "== RINGKASAN: berhasil=$OK  gagal=$FAIL"
[[ ${#ONLINE[@]} -gt 0 ]] && printf '   terpasang: %s\n' "${ONLINE[*]}"
for d in "${FAILED_DEVICES[@]}"; do printf '   GAGAL : %s\n' "$d"; done

[[ $FAIL -eq 0 ]]