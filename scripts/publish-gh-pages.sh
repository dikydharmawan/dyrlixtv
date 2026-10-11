#!/usr/bin/env bash
#
# Publikasikan APK rilis + update.json ke branch gh-pages, supaya self-updater
# di tiap TV/STB mengambil versi baru.
#
# Pemakaian:
#   ./scripts/publish-gh-pages.sh \
#     --apk /jalan/ke/dyrlix.apk \
#     --version-code 5 \
#     --version-name 1.0.3 \
#     [--notes "Perbaikan playback"]
#
# Hasil:
#   - APK diunggah sebagai dyrlix-<versionName>.apk di branch gh-pages
#   - update.json diperbarui (apkUrl menunjuk file tersebut)
#   - APK lama (dyrlix-*.apk) dihapus agar repo tidak membengkak
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BRANCH="gh-pages"

APK=""
VERSION_CODE=""
VERSION_NAME=""
NOTES=""

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apk) APK="${2:-}"; shift 2 ;;
    --version-code) VERSION_CODE="${2:?}"; shift 2 ;;
    --version-name) VERSION_NAME="${2:?}"; shift 2 ;;
    --notes) NOTES="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumen tidak dikenal: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "Butuh --apk <file.apk> yang ada." >&2
  exit 1
fi
if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "Butuh --version-code <angka>." >&2
  exit 1
fi

# Tentukan owner/repo dari remote origin untuk membentuk URL APK publik.
REMOTE_URL="$(git -C "$PROJECT_ROOT" remote get-url origin)"
case "$REMOTE_URL" in
  git@github.com:*) SLUG="${REMOTE_URL#git@github.com:}" ;;
  https://github.com/*) SLUG="${REMOTE_URL#https://github.com/}" ;;
  *) SLUG="$REMOTE_URL" ;;
esac
SLUG="${SLUG%.git}"

APK_NAME="dyrlix-${VERSION_NAME:-$VERSION_CODE}.apk"
APK_URL="https://raw.githubusercontent.com/${SLUG}/gh-pages/${APK_NAME}"

echo "Repo        : $SLUG"
echo "APK         : $APK_NAME"
echo "versionCode : $VERSION_CODE"
echo "URL         : $APK_URL"
echo

# Siapkan worktree untuk branch gh-pages (dibuat dari remote bila belum ada lokal).
WORKTREE="$(mktemp -d)"
cleanup() { git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || rm -rf "$WORKTREE"; }
trap cleanup EXIT

if git -C "$PROJECT_ROOT" show-ref --verify --quiet "refs/heads/gh-pages"; then
  git -C "$PROJECT_ROOT" worktree add --force "$WORKTREE" gh-pages
else
  git -C "$PROJECT_ROOT" fetch origin gh-pages
  git -C "$PROJECT_ROOT" worktree add --force "$WORKTREE" -b gh-pages origin/gh-pages
fi

# Salin APK, ganti rilis lama (hapus APK versi sebelumnya).
rm -f "$WORKTREE"/dyrlix-*.apk
cp "$APK" "$WORKTREE/$APK_NAME"

# Tulis manifest update.json yang menunjuk APK baru.
node "$PROJECT_ROOT/scripts/prepare-update.js" \
  --version-code "$VERSION_CODE" \
  --version-name "${VERSION_NAME:-}" \
  --apk-url "$APK_URL" \
  --notes "${NOTES:-}" \
  --out "$WORKTREE/update.json"

git -C "$WORKTREE" add -A
# .gitignore gh-pages mengabaikan *.apk, jadi paksa tambahkan rilis ini.
git -C "$WORKTREE" add -f "$APK_NAME"
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "Tidak ada perubahan untuk di-commit."
  exit 0
fi
git -C "$WORKTREE" commit -q -m "Rilis ${VERSION_NAME:-$VERSION_CODE} (versionCode $VERSION_CODE)"
git -C "$WORKTREE" push origin gh-pages

echo
echo "Selesai. URL manifest self-updater (raw GitHub — pembaruan cepat & andal):"
echo "  https://raw.githubusercontent.com/${SLUG}/gh-pages/update.json"
echo "Cadangan via jsDelivr (bisa macet karena cache @branch):"
echo "  https://cdn.jsdelivr.net/gh/${SLUG}@gh-pages/update.json"
echo "  (cadangan GitHub: https://github.com/${SLUG}/raw/gh-pages/update.json )"
