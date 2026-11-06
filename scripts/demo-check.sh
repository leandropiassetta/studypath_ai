#!/usr/bin/env bash
# Pre-interview checklist: confirms every piece of the demo works RIGHT NOW, end to end,
# including the AI path (and tells you whether the answers come from the AI or the fallback).
# Needs the API running at $API_URL. Never prints passwords or keys.
set -uo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/demo-lib.sh
. scripts/demo-lib.sh

failed=0
check() { # label, command...
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else fail "$label"; failed=1; fi
}

echo "Verificação da demo ($API_URL)"
echo
echo "Infraestrutura"
check "Docker responde"                                  docker info
check "PostgreSQL saudável"                              bash -c 'docker compose ps --format "{{.Status}}" | grep -q healthy'
check "Redis saudável (fila BullMQ)"                    bash -c 'docker compose ps --format "{{.Name}} {{.Status}}" | grep redis | grep -q healthy'
check "API responde (/health)"                           curl -fsS "$API_URL/health"
migrations="$(psql_local 'SELECT count(*) FROM migrations' 2>/dev/null || echo 0)"
if [ "${migrations:-0}" -ge 7 ]; then ok "Migrations aplicadas ($migrations)"; else fail "Migrations faltando (achei $migrations, esperado 7+): npm run demo:setup"; failed=1; fi
check "Flutter instalado"                                flutter --version
check "Chrome instalado"                                 test -d "/Applications/Google Chrome.app"

echo
echo "Contas"
TEACHER_TOKEN="$(api_login "$TEACHER_EMAIL" "$TEACHER_PASSWORD" 2>/dev/null)"
if [ -n "${TEACHER_TOKEN:-}" ]; then ok "Professora consegue entrar ($TEACHER_EMAIL)"; else fail "Professora NÃO entra: npm run demo:setup"; failed=1; fi
DEMO_TOKEN="$(api_login "$DEMO_EMAIL" "$DEMO_PASSWORD" 2>/dev/null)"
if [ -n "${DEMO_TOKEN:-}" ]; then ok "Aluna demo consegue entrar ($DEMO_EMAIL)"; else fail "Aluna demo NÃO entra: npm run demo:setup"; failed=1; fi

echo
echo "Fluxo completo com uma conta descartável (cadastro → simulado → dúvida → dica → professora → resposta)"
RESULT="$(API_URL="$API_URL" TEACHER_TOKEN="${TEACHER_TOKEN:-}" python3 - <<'PY' 2>&1
import json, os, time, urllib.request, uuid

api = os.environ["API_URL"]

def call(method, path, body=None, token=None):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    req = urllib.request.Request(api + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

try:
    email = f"check-{uuid.uuid4().hex[:8]}@exemplo.dev"
    reg = call("POST", "/api/v1/auth/register", {"name": "Check Descartavel", "email": email, "password": uuid.uuid4().hex})
    token, sid = reg["token"], reg["student"]["id"]
    quiz = call("GET", "/api/v1/quizzes/demo-matematica", token=token)
    picks = ["B", "B", "A", "C", "B", "C", "B", "B"]  # erra a questão 3
    att = call("POST", "/api/v1/attempts", {"requestId": str(uuid.uuid4()), "studentId": sid, "quizId": quiz["id"],
        "answers": [{"questionId": q["id"], "selectedOption": p} for q, p in zip(quiz["questions"], picks)]}, token)
    wrong = next(a["questionId"] for a in att["answers"] if not a["isCorrect"])
    doubt = call("POST", "/api/v1/doubts", {"attemptId": att["attemptId"], "questionId": wrong}, token)
    hint = call("POST", f"/api/v1/doubts/{doubt['id']}/hints", {}, token)
    call("POST", f"/api/v1/doubts/{doubt['id']}/teacher", {}, token)
    teacher_token = os.environ.get("TEACHER_TOKEN")
    queue = call("GET", "/api/v1/teacher/doubts", token=teacher_token) if teacher_token else []
    in_queue = any(d["id"] == doubt["id"] for d in queue)
    enriched = False
    for _ in range(20):  # the background job fills the context for the teacher within a few seconds
        item = next((d for d in call("GET", "/api/v1/teacher/doubts", token=teacher_token) if d["id"] == doubt["id"]), None) if teacher_token else None
        if item and item["misconception"]:
            enriched = True
            break
        time.sleep(0.5)
    if teacher_token and in_queue:
        call("POST", f"/api/v1/teacher/doubts/{doubt['id']}/answer", {"answer": "Resposta do verificador."}, teacher_token)
    final = call("GET", f"/api/v1/doubts/{doubt['id']}", token=token)
    print(json.dumps({"source": hint["source"], "level": hint["level"], "in_queue": in_queue, "enriched": enriched, "answered": final["status"] == "ANSWERED"}))
except Exception as exc:  # noqa: BLE001
    print(json.dumps({"error": str(exc)[:120]}))
PY
)"
if printf '%s' "$RESULT" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read().strip().splitlines()[-1]); sys.exit(0 if "error" not in d else 1)' 2>/dev/null; then
  SRC="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read().strip().splitlines()[-1])["source"])')"
  INQ="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read().strip().splitlines()[-1])["in_queue"])')"
  ENR="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read().strip().splitlines()[-1])["enriched"])')"
  ANS="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read().strip().splitlines()[-1])["answered"])')"
  ok "Dica de IA entregue (fonte: $SRC)"
  if [ "$SRC" = "reference" ]; then info "A fonte é 'reference': a IA está desligada, em mock-sem-chave ou falhou. Com AI_MODE=real isso indica problema de chave/rede."; fi
  if [ "$INQ" = "True" ]; then ok "Dúvida apareceu na fila da professora"; else fail "Dúvida NÃO apareceu na fila"; failed=1; fi
  if [ "$ENR" = "True" ]; then ok "Job em segundo plano (BullMQ) preencheu o equívoco para a professora"; else fail "Job em segundo plano NÃO rodou: a API foi iniciada com REDIS_URL? (veja DEMO.md)"; failed=1; fi
  if [ "$ANS" = "True" ]; then ok "Professora respondeu e a aluna recebeu"; else fail "Resposta do professor não chegou à aluna"; failed=1; fi
else
  fail "O fluxo completo falhou: $(printf '%s' "$RESULT" | tail -1)"; failed=1
fi

echo
if [ "$failed" -eq 0 ]; then
  printf '\033[32mTudo certo para a demo.\033[0m\n'
else
  printf '\033[31mHá itens com problema (veja os ✗ acima). Plano B: DEMO.md, seção "Se algo der errado".\033[0m\n'
  exit 1
fi
