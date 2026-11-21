#!/bin/bash
# End-to-end tests in scratch git repos. GUARDRAIL_CMD overrides the command (default: jbang on the script).
set -u
here=$(cd "$(dirname "$0")" && pwd)
GR=${GUARDRAIL_CMD:-"jbang $here/OnecxGuardrail.java"}
fix=$here/fixtures
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $3, got $2)"; fail=1; fi; }
newrepo() {
  d=$(mktemp -d); cd "$d" || exit 2
  git init -q . && git config user.email t@t && git config user.name t
  git commit -q --allow-empty -m init
}
put() { mkdir -p "$(dirname "$2")"; cp "$fix/$1.java.fixture" "$2"; }
run() { $GR "$@" >/tmp/gr-out.txt 2>/tmp/gr-err.txt; echo $?; }

echo "# staged new bad file"
newrepo; put Bad src/Bad.java; git add .
check "exit 1" "$(run --staged)" 1
grep -q "TOO_MANY_PARAMETERS" /tmp/gr-err.txt && grep -q "BOOLEAN_FLAG_PARAMETER" /tmp/gr-err.txt \
  && grep -q "Target: src/Bad.java :: Bad.many" /tmp/gr-err.txt && grep -q "Metric: new -> 4 (allowed: <= 3)" /tmp/gr-err.txt \
  && echo "ok   agent output" || { echo "FAIL agent output"; fail=1; }
put Good src/Good.java; git rm -q --cached src/Bad.java; rm src/Bad.java; git add .
check "good file passes" "$(run --staged)" 0
grep -q "PASSED\] 1 file" /tmp/gr-out.txt && echo "ok   pass line" || { echo "FAIL pass line"; fail=1; }

echo "# ratchet"
newrepo; put Legacy src/Legacy.java; git add .; git commit -q -m legacy
put Legacy5 src/Legacy.java; git add .
check "increase fails" "$(run --staged)" 1
put Legacy src/Legacy.java; git add .
check "unchanged passes" "$(run --staged)" 0
put Legacy3 src/Legacy.java; git add .
check "decrease passes" "$(run --staged)" 0

echo "# baseline"
newrepo; put Bad src/Bad.java; git add .
check "fails without baseline" "$(run --strict)" 1
check "init-baseline exit" "$(run --init-baseline)" 0
grep -q '"runtime": "java"' .guardrail-baseline.json && echo "ok   baseline runtime" || { echo "FAIL baseline runtime"; fail=1; }
check "passes with baseline" "$(run)" 0

echo "# cycles"
newrepo; put CycA src/a/CycA.java; put CycB src/b/CycB.java; git add .
check "cycle fails" "$(run)" 1
grep -q "CIRCULAR_DEPENDENCY" /tmp/gr-err.txt && grep -q "demo.a -> demo.b -> demo.a" /tmp/gr-err.txt \
  && echo "ok   cycle output" || { echo "FAIL cycle output"; fail=1; }

echo "# suppressions"
newrepo; put Supp src/Supp.java; git add .
check "suppression fails" "$(run --staged)" 1
grep -q "FORBIDDEN_SUPPRESSION" /tmp/gr-err.txt && grep -q "src/Supp.java:4" /tmp/gr-err.txt \
  && echo "ok   suppression output" || { echo "FAIL suppression output"; fail=1; }

echo "# interfaces, records, enums, annotation types"
newrepo; put Shapes src/Shapes.java; git add .
check "shapes pass" "$(run --strict)" 0

echo "# json"
newrepo; put Bad src/Bad.java; git add .
check "json exit" "$(run --staged --format json)" 1
[ ! -s /tmp/gr-err.txt ] && echo "ok   stderr empty" || { echo "FAIL stderr not empty"; fail=1; }
python3 - /tmp/gr-out.txt "$here/../../shared/output.schema.json" <<'PY' && echo "ok   schema" || { echo "FAIL schema"; fail=1; }
import json, re, sys
out = json.load(open(sys.argv[1])); schema = json.load(open(sys.argv[2]))
try:
    import jsonschema; jsonschema.validate(out, schema); sys.exit(0)
except ImportError:
    pass
v = schema["properties"]["violations"]["items"]
rules = schema["$defs"]["ruleCode"]["enum"]
assert set(out) == set(schema["required"]) and out["tool"] == "onecx-guardrail" and out["runtime"] == "java"
assert isinstance(out["passed"], bool) and out["violations"]
for x in out["violations"]:
    assert set(x) == set(v["required"]) and x["rule"] in rules
    assert all(isinstance(x[k], str) for k in ("target", "principle", "why", "fix"))
    assert all(x[k] is None or isinstance(x[k], (int, float)) for k in ("before", "after", "limit"))
PY
exit $fail
