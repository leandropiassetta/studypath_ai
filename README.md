# StudyPath AI

MVP de simulados, diagnóstico de dificuldades e recomendações de estudo. Especificação: [docs/StudyPath_AI_SPEC.md](docs/StudyPath_AI_SPEC.md).

## Estado atual: T01 (workspace + backend vazio)

Requisitos: Node >= 22.

```bash
npm install
npm run lint && npm run typecheck && npm run test && npm run build
npm run dev -w backend   # API em 127.0.0.1:3000 (configure via .env.example)
```
