#!/usr/bin/env bash
# Demonstrates idempotency (RN-05): sends the same attempt twice with one requestId.
# Usage: scripts/demo-replay.sh [API_BASE_URL]   (needs the API running and python3)
set -euo pipefail

API="${1:-http://127.0.0.1:3000}"
REQUEST_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"

# A throwaway account: every API route needs a session (the password is random and never printed).
EMAIL="demo-$(python3 -c 'import uuid; print(uuid.uuid4().hex[:10])')@exemplo.dev"
PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(18))')"
SESSION="$(curl -fsS -H 'content-type: application/json' \
  -d "{\"name\":\"Demo Replay\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$API/api/v1/auth/register")"
TOKEN="$(printf '%s' "$SESSION" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
STUDENT_ID="$(printf '%s' "$SESSION" | python3 -c 'import json,sys; print(json.load(sys.stdin)["student"]["id"])')"

BODY="$(curl -fsS -H "authorization: Bearer $TOKEN" "$API/api/v1/quizzes/demo-matematica" | STUDENT_ID="$STUDENT_ID" REQUEST_ID="$REQUEST_ID" python3 -c '
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
    -H 'content-type: application/json' -H "authorization: Bearer $TOKEN" \
    -d "$BODY" "$API/api/v1/attempts")"
  echo "POST #$attempt -> HTTP $code, attemptId=$(python3 -c "import json;print(json.load(open('/tmp/studypath-replay-$attempt.json'))['attemptId'])")"
done
cmp -s /tmp/studypath-replay-1.json /tmp/studypath-replay-2.json && echo "Replay returned an identical body (no duplicate)."
