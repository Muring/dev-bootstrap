#!/usr/bin/env bash
set -euo pipefail
PDP_RUNTIME="${PDP_RUNTIME:-${XDG_CACHE_HOME:-$HOME/.cache}/shopify-pdp}"
mkdir -p "$PDP_RUNTIME/node" "$PDP_RUNTIME/libs"
command -v uv >/dev/null || { echo 'Install uv, then rerun pdp setup.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'Install Node.js and npm, then rerun pdp setup.' >&2; exit 1; }
if [ ! -x "$PDP_RUNTIME/venv/bin/python" ]; then uv venv --python 3.12 "$PDP_RUNTIME/venv"; fi
uv pip install --python "$PDP_RUNTIME/venv/bin/python" pymupdf==1.28.2 pillow==12.3.0 fonttools==4.65.0 brotli==1.2.0 numpy==2.5.3 pyyaml==6.0.3
npm install --prefix "$PDP_RUNTIME/node" --no-audit --no-fund playwright@1.63.0
node "$PDP_RUNTIME/node/node_modules/playwright/cli.js" install chromium
PDP_BROWSER="$(node -e 'const {chromium}=require(process.argv[1]);process.stdout.write(chromium.executablePath())' "$PDP_RUNTIME/node/node_modules/playwright")"
# On minimal Debian/Ubuntu hosts, supply the common missing browser libraries
# in our own cache; do not require sudo or a previous product's copied libraries.
if command -v ldd >/dev/null && ldd "$PDP_BROWSER" | grep -q 'not found'; then
 if command -v apt-get >/dev/null && command -v dpkg-deb >/dev/null; then
  (cd "$PDP_RUNTIME/libs"
   apt-get download libnspr4 libnss3 libasound2t64
   for PDP_DEB in ./*.deb; do dpkg-deb -x "$PDP_DEB" .; done)
 fi
fi
PDP_RUNTIME="$PDP_RUNTIME" node --input-type=module -e '
const {createRequire}=await import("node:module");const path=await import("node:path");
const r=process.env.PDP_RUNTIME;const require=createRequire(path.join(r,"node/package.json"));const {chromium}=require("playwright");
const b=await chromium.launch({headless:true,executablePath:process.env.PDP_CHROME||chromium.executablePath(),env:{...process.env,LD_LIBRARY_PATH:[path.join(r,"libs/usr/lib/x86_64-linux-gnu"),process.env.LD_LIBRARY_PATH].filter(Boolean).join(":")}});await b.close();console.log("Independent PDP runtime ready: "+r);'
