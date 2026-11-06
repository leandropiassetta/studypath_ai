#!/usr/bin/env bash
# Puts the demo student back in a known state: no previous doubts and two earlier full quizzes
# (25% then 50%), so the evolution chart and the recommendations have something to show.
# Only touches the demo student. Needs the API running at $API_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/demo-lib.sh
. scripts/demo-lib.sh

curl -fsS "$API_URL/health" >/dev/null || { fail "A API não está respondendo em $API_URL. Suba a API primeiro."; exit 1; }

deleted="$(psql_local "WITH d AS (DELETE FROM attempts WHERE student_id = '$DEMO_STUDENT_ID' RETURNING 1) SELECT count(*) FROM d")"
ok "Histórico anterior da aluna demo removido ($deleted tentativa(s); dúvidas e dicas saem junto)"

TOKEN="$(api_login "$DEMO_EMAIL" "$DEMO_PASSWORD")" || { fail "A aluna demo não consegue entrar. Rode 'npm run demo:setup' antes."; exit 1; }

API_URL="$API_URL" TOKEN="$TOKEN" STUDENT_ID="$DEMO_STUDENT_ID" python3 - <<'PY'
import json, os, urllib.request, uuid

api, token, student = os.environ["API_URL"], os.environ["TOKEN"], os.environ["STUDENT_ID"]

def call(method, path, body=None):
    req = urllib.request.Request(
        api + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

quiz = call("GET", "/api/v1/quizzes/demo-matematica")
# Correct keys by position: Equações B B C C | Geometria B C B B
histories = [
    ("1ª tentativa", ["B", "A", "A", "A", "B", "A", "A", "A"]),  # 2/8 = 25%
    ("2ª tentativa", ["B", "B", "A", "A", "B", "C", "A", "A"]),  # 4/8 = 50%
]
for label, picks in histories:
    result = call("POST", "/api/v1/attempts", {
        "requestId": str(uuid.uuid4()),
        "studentId": student,
        "quizId": quiz["id"],
        "answers": [{"questionId": q["id"], "selectedOption": p} for q, p in zip(quiz["questions"], picks)],
    })
    print(f"  \033[32m✓\033[0m {label}: {result['correctCount']}/{result['totalCount']} ({result['scorePct']:g}%)")
PY
echo
info "Pronto. Entre como a aluna demo e faça um NOVO simulado ao vivo: a evolução vai mostrar 25% → 50% → o resultado de agora."
