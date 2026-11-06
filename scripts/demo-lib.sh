# shellcheck shell=bash
# Shared helpers for the demo scripts. FICTIONAL, LOCAL-ONLY credentials: used to fill the local
# database for a presentation. Override any of them with environment variables.
export API_URL="${API_URL:-http://127.0.0.1:3100}"
export DEMO_EMAIL="${DEMO_EMAIL:-aluna.demo@exemplo.dev}"
export DEMO_PASSWORD="${DEMO_PASSWORD:-demo1234}"
export TEACHER_EMAIL="${TEACHER_EMAIL:-professora@exemplo.dev}"
export TEACHER_PASSWORD="${TEACHER_PASSWORD:-professora123}"
export TEACHER_NAME="${TEACHER_NAME:-Profa. Helena}"
export DEMO_STUDENT_ID="55555555-5555-4555-8555-555555555555"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { printf '  \033[36m•\033[0m %s\n' "$*"; }

# Logs in and prints only the bearer token (never the password).
api_login() { # email password
  curl -fsS -H 'content-type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"email":sys.argv[1],"password":sys.argv[2]}))' "$1" "$2")" \
    "$API_URL/api/v1/auth/login" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

psql_local() { docker compose exec -T postgres psql -U studypath -d studypath -tAc "$1"; }
