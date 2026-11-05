#!/usr/bin/env bash
# Demonstrates idempotency (RN-05): sends the same attempt twice with one requestId.
# Usage: scripts/demo-replay.sh [API_BASE_URL]   (needs the API running and python3)
set -euo pipefail

API="${1:-http://127.0.0.1:3000}"
STUDENT_ID="${DEMO_STUDENT_ID:-55555555-5555-4555-8555-555555555555}"
REQUEST_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"

BODY="$(curl -fsS "$API/api/v1/quizzes/demo-matematica" | STUDENT_ID="$STUDENT_ID" REQUEST_ID="$REQUEST_ID" python3 -c '
import json, os, sys
quiz = json.load(sys.stdin)
# 1/4 correct in Equações, 3/4 in Geometria
picks = ["B", "A", "A", "A", "B", "C", "B", "A"]
print(json.dumps({
    "requestId": os.environ["REQUEST_ID"],
    "studentId": os.environ["STUDENT_ID"],
    "quizId": quiz["id"],
    "answers": [{"questionId": q["id"], "selectedOption": p} for q, p in zip(quiz["questions"], picks)],
}))')"

for attempt in 1 2; do
  code="$(curl -sS -o "/tmp/studypath-replay-$attempt.json" -w '%{http_code}' \
    -H 'content-type: application/json' -d "$BODY" "$API/api/v1/attempts")"
  echo "POST #$attempt -> HTTP $code, attemptId=$(python3 -c "import json;print(json.load(open('/tmp/studypath-replay-$attempt.json'))['attemptId'])")"
done
cmp -s /tmp/studypath-replay-1.json /tmp/studypath-replay-2.json && echo "Replay returned an identical body (no duplicate)."
