#!/usr/bin/env bash
# Generate the per-edition extension signing keys and derive each stable extension ID.
#
# The RSA private key signs the self-hosted .crx; its public key (base64 DER) is the manifest "key"
# field, which pins a CONSTANT extension ID across every update (managed policy + force-install depend
# on that ID). Keys are written here under signing/ (gitignored) and MUST be backed up securely:
# losing a key means you cannot ship a same-ID update, and the ID would change.
#
# Run from the repo root:  bash signing/gen_keys.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p signing

for ed in personal enterprise; do
  pem="signing/${ed}.pem"
  if [ ! -f "$pem" ]; then
    openssl genrsa -out "$pem" 2048 2>/dev/null
    echo "generated $pem"
  else
    echo "keeping existing $pem"
  fi
  key=$(openssl rsa -in "$pem" -pubout -outform DER 2>/dev/null | openssl base64 -A)
  id=$(openssl rsa -in "$pem" -pubout -outform DER 2>/dev/null | openssl dgst -sha256 \
        | awk '{print $NF}' | head -c 32 | tr '0-9a-f' 'a-p')
  printf '%s' "$key" > "signing/${ed}.key"
  printf '%s' "$id"  > "signing/${ed}.id"
  echo "  ${ed}: extension id = ${id}"
done
