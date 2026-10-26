#!/usr/bin/env bash
# Copies the shared files (settings, welcome guide, AI connection) into every
# extension. Edit them in shared/ and run this; never edit the copies.
set -euo pipefail
cd "$(dirname "$0")"
for ext in skins tidy; do
  cp shared/ai.js shared/ui.css shared/settings.html shared/settings.js shared/welcome.html shared/welcome.js "$ext/"
done
echo "Shared files copied into: skins, tidy"
