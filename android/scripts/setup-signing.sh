#!/usr/bin/env bash
# ONE-TIME setup (laptop). Uploads your DataLeap signing key to GitHub as the 4 secrets the build needs.
#   ./android/scripts/setup-signing.sh path/to/dataleap-release.jks
# Needs: GitHub CLI (gh), base64. On a phone, add the secrets by hand instead (see secrets-for-github.txt in your private key zip).
set -euo pipefail
KS="${1:-$HOME/dataleap-signing/dataleap-release.jks}"
REPO="${DL_REPO:-souravroy0708/dataleap}"
[ -f "$KS" ] || { echo "Keystore not found: $KS"; exit 1; }
command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --web --scopes repo,workflow
read -r -s -p "Keystore password: " PASS; echo
base64 -w0 "$KS" | gh secret set DL_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$PASS"     | gh secret set DL_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "dataleap"  | gh secret set DL_KEY_ALIAS --repo "$REPO"
printf '%s' "$PASS"     | gh secret set DL_KEY_PASSWORD --repo "$REPO"
echo "Done. Run the 'Build DataLeap APK' workflow from the Actions tab, or push a change."
