#!/usr/bin/env bash
# Capture le presse-papier réel (Wayland) en extraits de test : copier d'abord une plage dans le tableur, puis
#   scripts/capturer-presse-papier.sh calc      (ou sheets, excel…)
# Chaque type présent est écrit dans scripts/fixtures/presse-papier/<nom>/ ; types.txt garde la liste complète.
set -euo pipefail
nom="${1:?usage : $0 <nom de la source, ex. calc>}"
command -v wl-paste >/dev/null || { echo "wl-paste introuvable (paquet wl-clipboard)" >&2; exit 1; }
dest="$(dirname "$0")/fixtures/presse-papier/$nom"
mkdir -p "$dest"
wl-paste --list-types > "$dest/types.txt"
while read -r type; do
  case "$type" in
    text/html) f=presse.html ;;
    text/plain|text/plain\;charset=utf-8) f=presse.txt ;;
    image/png) f=presse.png ;;
    *) continue ;;
  esac
  wl-paste --type "$type" > "$dest/$f"
done < "$dest/types.txt"
echo "capturé dans $dest :"; ls -1 "$dest"
