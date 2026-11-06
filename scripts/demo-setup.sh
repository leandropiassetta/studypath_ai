#!/usr/bin/env bash
# Prepares the local environment for the demo: database up, migrations, seed, and the demo
# student and the teacher with a login. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/demo-lib.sh
. scripts/demo-lib.sh

echo "Preparando o ambiente da demo..."
npm run db:up >/dev/null && ok "PostgreSQL no ar"
npm run db:migrate >/dev/null && ok "Migrations aplicadas"
npm run db:seed >/dev/null && ok "Questões, simulado, aluna demo e professora criados"

echo
echo "Contas de demonstração (fictícias, só neste computador):"
info "Aluna:      $DEMO_EMAIL  /  $DEMO_PASSWORD"
info "Professora: $TEACHER_EMAIL  /  $TEACHER_PASSWORD"
echo
echo "Próximo passo: suba a API (porta 3100) e rode:  npm run demo:reset"
