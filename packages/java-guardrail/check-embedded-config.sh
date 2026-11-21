#!/bin/sh
# Verifies that the config embedded in OnecxGuardrail.java equals shared/default-config.json.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
python3 - "$here/Config.java" "$here/../../shared/default-config.json" <<'PY'
import json, re, sys
src = open(sys.argv[1], encoding="utf-8").read()
m = re.search(r'DEFAULT_CONFIG = """\n(.*?)"""', src, re.S)
if not m:
    sys.exit("embedded DEFAULT_CONFIG not found")
text = re.sub(r'\\u([0-9a-fA-F]{4})', lambda x: chr(int(x.group(1), 16)), m.group(1))
if json.loads(text) != json.load(open(sys.argv[2], encoding="utf-8")):
    sys.exit("embedded config differs from shared/default-config.json")
print("embedded config matches shared/default-config.json")
PY
