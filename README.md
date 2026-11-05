# StudyPath AI

MVP de simulados, diagnóstico de dificuldades e recomendações de estudo. A especificação oficial (SDD) é mantida localmente em `docs/StudyPath_AI_SPEC.md` e **não é versionada** (`docs/` está no `.gitignore`).

**Estado:** P0 (T01–T09) e P1 (T10 explicações por LLM com fallback; T11 melhorias de UI) completos. Android/iOS: projetos gerados, ainda não executados em emulador/dispositivo.

> **Somente uso local.** Não há autenticação real: a API aceita apenas o aluno fictício do modo demo e escuta em `127.0.0.1`. Não a exponha publicamente. Todos os dados são fictícios.

## Como funciona

- **Backend** (`backend/`): Node.js + Fastify + TypeScript strict, TypeORM, PostgreSQL. Camadas `routes → service → repository`, com regras de domínio puras (correção e recomendações) e sem uso de LLM.
- **App** (`mobile/flutter_app/`): Flutter (`http` + `setState`) com simulado, resultado e recomendações.
- **Banco**: PostgreSQL 16 via Docker Compose, com migrations versionadas e seed determinístico.

## Requisitos

Node >= 22 (`.nvmrc`), Docker e Flutter SDK (estável). Para o app em Chrome basta o Chrome.

## Executar (do zero)

```bash
cp .env.example .env     # credenciais locais de desenvolvimento; não são segredos
npm install
npm run db:up            # PostgreSQL em 127.0.0.1:5432 (espera ficar saudável)
npm run db:migrate       # aplica as migrations em banco vazio
npm run db:seed          # dados fictícios (idempotente)
npm run dev -w backend   # API em http://127.0.0.1:3000
```

Em outro terminal, o app:

```bash
cd mobile/flutter_app
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

Emulador Android: use `--dart-define=API_BASE_URL=http://10.0.2.2:3000`. A API só aceita CORS de origens `localhost` e `127.0.0.1` (necessário para o Flutter web).

### Variáveis de ambiente (`.env`)

| Variável                    | Padrão                                 | Uso                                            |
| --------------------------- | -------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`              | _(obrigatória)_                        | Conexão com o PostgreSQL                       |
| `HOST` / `PORT`             | `127.0.0.1` / `3000`                   | Endereço da API (mantenha em loopback)         |
| `APP_ENV`                   | `demo`                                 | Modo demo                                      |
| `DEMO_STUDENT_ID`           | `55555555-5555-4555-8555-555555555555` | Único aluno aceito pela API                    |
| `AI_MODE`                   | `disabled`                             | `disabled`, `mock` ou `real` (explicações)     |
| `AI_TIMEOUT_MS`             | `8000`                                 | Timeout da chamada à LLM                       |
| `LLM_PROVIDER`              | `anthropic`                            | `anthropic` ou `openai` (só em `AI_MODE=real`) |
| `LLM_API_KEY` / `LLM_MODEL` | _(só em `AI_MODE=real`)_               | Chave e modelo; nunca versione a chave         |
| `API_BASE_URL`              | `http://127.0.0.1:3000`                | Flutter, via `--dart-define`                   |

## Dados do seed (fictícios)

| Item       | Valor                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Aluno demo | `55555555-5555-4555-8555-555555555555`                                                                |
| Simulado   | `demo-matematica` (`11111111-1111-4111-8111-111111111111`), 8 questões: 4 de Equações, 4 de Geometria |
| Extras     | 16 questões fora do simulado (8 por assunto), usadas nas recomendações e nos quizzes de revisão       |

## API

| Método e rota                                     | Descrição                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                     | 200 `{"status":"ok"}` ou 503 se o banco estiver indisponível                                                                          |
| `GET /api/v1/quizzes/:slug`                       | Simulado ativo com questões em ordem, sem gabarito                                                                                    |
| `POST /api/v1/attempts`                           | Corrige e grava a tentativa: 201 criada, 200 replay, 400/403/404/409                                                                  |
| `POST /api/v1/students/:studentId/review-quizzes` | Cria (ou reaproveita) um quiz de revisão de um assunto recomendado, com até 3 questões; envie as respostas em `POST /api/v1/attempts` |
| `GET /api/v1/students/:studentId/recommendations` | Temas prioritários e até 3 exercícios inéditos por tema                                                                               |

`POST /api/v1/attempts/:attemptId/explanations` com `{"questionId":"..."}` devolve `{questionId, explanation, source}`. Só aceita questões **erradas** daquela tentativa do aluno demo (400 se acertada, 403/404 conforme acesso). `source` é `llm` ou `reference`: em timeout, erro ou saída inválida da LLM volta a explicação de referência, e nota, gabarito e recomendações nunca mudam. Nada gerado pela LLM é gravado em banco. **Controle de custo (em memória, zera ao reiniciar):** a explicação de uma questão fica em cache, então cliques repetidos não geram nova chamada; pedidos simultâneos da mesma questão compartilham uma só chamada; e há limite por minuto e por 24 h. Passado o limite, a API continua respondendo 200 com a explicação de referência e um campo `notice` explicando o motivo. Chamadas que falham também contam no limite. Com `AI_MODE=mock` não há rede nem chave (resposta determinística); com `real` usa a API do provedor em `LLM_PROVIDER` (Anthropic ou OpenAI).

Erros usam `{"error":{"code","message","details"}}`; erros 500 não expõem detalhes internos.

## Roteiro de demonstração (3 minutos)

1. Suba banco, API e app (comandos acima). Para começar do zero: `docker compose exec postgres psql -U studypath -d studypath -c "DELETE FROM attempts"`.
2. No app, veja as 8 questões. Responda **1 de 4 certas em Equações** e **3 de 4 em Geometria** (gabarito por posição: B, B, C, C | B, C, B, B).
3. Envie: o resultado mostra **50%**, correção por questão e resumo por assunto.
4. Abra "Ver recomendações de estudo" (a tela mostra também a evolução nos simulados completos): **Equações** aparece com prioridade alta e **Geometria** (75%) como revisão opcional, cada um com 3 exercícios ainda não respondidos.
5. Em "Praticar este assunto" responda o quiz de revisão (até 3 questões inéditas do assunto, ou as ainda erradas quando não houver inéditas) e volte: as recomendações se atualizam.
6. Idempotência: `scripts/demo-replay.sh` envia o mesmo `requestId` duas vezes (HTTP 201 e depois 200, mesmo `attemptId`, sem duplicar respostas).
7. Na tela de resultado, toque em "Explicar meu erro" numa questão errada. Com `AI_MODE=mock` (reinicie a API com essa variável) aparece "Explicação gerada por IA"; com a IA desligada ou indisponível, "Explicação de referência". A nota nunca muda.
8. Decisões a explicar: correção determinística, transação, idempotência e IA restrita à explicação, com fallback.

Teste de resiliência no app: pare a API (`Ctrl+C`), tente enviar e veja o erro com "Tentar enviar novamente"; suba a API de novo e reenvie. O reenvio usa o mesmo `requestId`, então não duplica a tentativa.

## Qualidade

```bash
npm run lint && npm run typecheck && npm run test && npm run build   # backend (precisa do Postgres no ar)
cd mobile/flutter_app && flutter analyze && flutter test            # app
```

Os testes de integração usam o banco isolado `studypath_test` (criado pelo Docker Compose), que é recriado do zero a cada arquivo de teste. Se o volume do Postgres é anterior à criação desse banco, rode `npm run db:down -- -v` e `npm run db:up`.

## Limitações conhecidas

- A regra de prioridade é uma heurística de demonstração, sem validação pedagógica. Considerando **todas** as tentativas, conta a **última resposta de cada questão** (erros já corrigidos deixam de pesar): com >= 2 questões respondidas, < 60% de acerto é `HIGH` e de 60% a 99% é `LOW` (revisão opcional).
- O simulado tem poucas questões fixas, então repetir tentativas pode medir memorização. A tela de recomendações mostra a **evolução por tentativa** e avisa que isso não prova aprendizado; só questões novas medem isso de verdade, e o banco tem poucas (8 extras por assunto). Quando acabam, o quiz de revisão refaz as questões ainda erradas, o que a tela avisa.
- Sem autenticação, cadastro ou ranking.
- O app Flutter tem apenas a plataforma web gerada; Android e iOS (`flutter create --platforms=android,ios .`) ficam para a etapa de testes em dispositivo.
