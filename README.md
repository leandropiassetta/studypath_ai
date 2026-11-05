# StudyPath AI

MVP de simulados, diagnóstico de dificuldades e recomendações de estudo. Especificação: [docs/StudyPath_AI_SPEC.md](docs/StudyPath_AI_SPEC.md).

## Estado atual: T02 (Postgres + TypeORM + migrations)

Requisitos: Node >= 22, Docker.

```bash
cp .env.example .env     # credenciais locais de desenvolvimento, sem segredos
npm install
npm run db:up            # PostgreSQL 16 em 127.0.0.1:5432 (aguarda ficar saudável)
npm run db:migrate       # aplica as migrations em banco vazio
npm run lint && npm run typecheck && npm run test && npm run build
npm run dev -w backend   # API em 127.0.0.1:3000
```

O `docker compose` cria dois bancos: `studypath` (desenvolvimento) e `studypath_test` (usado só pelos testes de integração, que o recriam do zero). Se o volume já existia antes da T02, rode `npm run db:down -- -v` e `npm run db:up` para criar o banco de teste.
