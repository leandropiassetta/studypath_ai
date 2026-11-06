# StudyPath AI

MVP de simulados, diagnóstico de dificuldades e recomendações de estudo. A especificação oficial (SDD) é mantida localmente em `docs/StudyPath_AI_SPEC.md` e **não é versionada** (`docs/` está no `.gitignore`).

**Estado:** P0 (T01–T09) e P1 (T10 explicações por LLM com fallback; T11 melhorias de UI) completos. Android/iOS: projetos gerados, ainda não executados em emulador/dispositivo.

> **Uso local.** Há cadastro e login reais (senha com scrypt, sessão por token), mas a API fala HTTP puro, sem TLS, e escuta só em `127.0.0.1`. Não a exponha publicamente sem um proxy HTTPS. Todos os dados de exemplo são fictícios.

## Como funciona

- **Backend** (`backend/`): Node.js + Fastify + TypeScript strict, TypeORM, PostgreSQL. Camadas `routes → service → repository`, com regras de domínio puras (correção e recomendações) e sem uso de LLM.
- **App** (`mobile/flutter_app/`): Flutter (`http` + `setState`) com cadastro/login, simulado, resultado, recomendações e quiz de revisão. A sessão fica **só em memória**: fechar o app desloga (nada é gravado em disco). Segue o tema claro/escuro do sistema.
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

Emulador Android: use `--dart-define=API_BASE_URL=http://10.0.2.2:3000` (o emulador enxerga o `127.0.0.1` do computador como `10.0.2.2`). Requisitos validados: Android SDK (platform 36, build-tools 36.0.0, imagem `google_apis;x86_64`), JDK 21 e `flutter config --android-sdk <caminho> --jdk-dir <jdk21>`. Depois `flutter run -d <emulador> --dart-define=API_BASE_URL=http://10.0.2.2:3000`. O tráfego HTTP em texto puro só é liberado no build de debug. Dica para Mac Intel: inicie o emulador com `emulator -avd <nome> -gpu host` (a renderização por software, `-gpu swiftshader_indirect`, deixou o emulador quase sem resposta). Se ele travar com "No space left on device", reinicie com `-wipe-data`. A API só aceita CORS de origens `localhost` e `127.0.0.1` (necessário para o Flutter web).

### Variáveis de ambiente (`.env`)

| Variável                       | Padrão                                 | Uso                                                                                                         |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | _(obrigatória)_                        | Conexão com o PostgreSQL                                                                                    |
| `HOST` / `PORT`                | `127.0.0.1` / `3000`                   | Endereço da API (mantenha em loopback)                                                                      |
| `ALLOW_NON_LOOPBACK_HOST`      | _(não definida)_                       | `true` libera `HOST` fora do loopback; sem isso a API recusa iniciar em `0.0.0.0`/IP de rede (HTTP sem TLS) |
| `APP_ENV`                      | `demo`                                 | Modo demo                                                                                                   |
| `SESSION_TTL_DAYS`             | `7`                                    | Duração do login, em dias (1 a 90)                                                                          |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | _(não definidas)_                      | Opcional, só para `npm run db:seed`: dá login ao aluno demo. Senha com 6+ caracteres; nunca versione        |
| `DEMO_STUDENT_ID`              | `55555555-5555-4555-8555-555555555555` | Único aluno aceito pela API                                                                                 |
| `AI_MODE`                      | `disabled`                             | `disabled`, `mock` ou `real` (explicações)                                                                  |
| `AI_TIMEOUT_MS`                | `8000`                                 | Timeout da chamada à LLM                                                                                    |
| `LLM_PROVIDER`                 | `anthropic`                            | `anthropic` ou `openai` (só em `AI_MODE=real`)                                                              |
| `LLM_API_KEY` / `LLM_MODEL`    | _(só em `AI_MODE=real`)_               | Chave e modelo; nunca versione a chave                                                                      |
| `API_BASE_URL`                 | `http://127.0.0.1:3000`                | Flutter, via `--dart-define`                                                                                |

## Dados do seed (fictícios)

| Item       | Valor                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Aluno demo | `55555555-5555-4555-8555-555555555555`                                                                |
| Simulado   | `demo-matematica` (`11111111-1111-4111-8111-111111111111`), 8 questões: 4 de Equações, 4 de Geometria |
| Extras     | 16 questões fora do simulado (8 por assunto), usadas nas recomendações e nos quizzes de revisão       |

## API

| Método e rota                                      | Descrição                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                      | 200 `{"status":"ok"}` ou 503 se o banco estiver indisponível (público)                                                                                |
| `POST /api/v1/auth/register`                       | Cria a conta (`name`, `email`, `password` de 6 a 128 caracteres) e já abre a sessão: 201 `{token, expiresAt, student}`; 400, 409 (e-mail em uso), 429 |
| `POST /api/v1/auth/login`                          | 200 `{token, expiresAt, student}`; 401 genérico (nunca diz se foi o e-mail ou a senha); 429 após 5 erros em 15 min                                    |
| `POST /api/v1/auth/logout` / `GET /api/v1/auth/me` | Encerra a sessão atual (204) / dados do aluno logado                                                                                                  |
| `GET /api/v1/quizzes/:slug`                        | Simulado ativo com questões em ordem, sem gabarito                                                                                                    |
| `POST /api/v1/attempts`                            | Corrige e grava a tentativa: 201 criada, 200 replay, 400/403/404/409                                                                                  |
| `POST /api/v1/students/:studentId/review-quizzes`  | Cria (ou reaproveita) um quiz de revisão de um assunto recomendado, com até 3 questões; envie as respostas em `POST /api/v1/attempts`                 |
| `GET /api/v1/students/:studentId/recommendations`  | Temas prioritários e até 3 exercícios inéditos por tema                                                                                               |

`POST /api/v1/attempts/:attemptId/explanations` com `{"questionId":"..."}` devolve `{questionId, explanation, source}`. Só aceita questões **erradas** daquela tentativa do aluno demo (400 se acertada, 403/404 conforme acesso). `source` é `llm` ou `reference`: em timeout, erro ou saída inválida da LLM volta a explicação de referência, e nota, gabarito e recomendações nunca mudam. Nada gerado pela LLM é gravado em banco. **Controle de custo (em memória, zera ao reiniciar):** a explicação de uma questão fica em cache, então cliques repetidos não geram nova chamada; pedidos simultâneos da mesma questão compartilham uma só chamada; e há limite por minuto e por 24 h. Passado o limite, a API continua respondendo 200 com a explicação de referência e um campo `notice` explicando o motivo. Chamadas que falham também contam no limite. Com `AI_MODE=mock` não há rede nem chave (resposta determinística); com `real` usa a API do provedor em `LLM_PROVIDER` (Anthropic ou OpenAI).

Erros usam `{"error":{"code","message","details"}}`; erros 500 não expõem detalhes internos.

**Todas as rotas abaixo exigem `Authorization: Bearer <token>`** (401 sem token válido). O aluno é sempre o da sessão: informar outro `studentId` no caminho ou no corpo dá 403, e a tentativa de outro aluno em `/explanations` aparece como 404.

## Roteiro de demonstração (3 minutos)

1. Suba banco, API e app (comandos acima) e **crie uma conta** na tela de cadastro (cada conta começa sem histórico, então não é preciso limpar nada).
2. No app, veja as 8 questões. Responda **1 de 4 certas em Equações** e **3 de 4 em Geometria** (gabarito por posição: B, B, C, C | B, C, B, B).
3. Envie: o resultado mostra **50%**, correção por questão e resumo por assunto.
4. Abra "Ver recomendações de estudo" (a tela mostra também a evolução nos simulados completos): **Equações** aparece com prioridade alta e **Geometria** (75%) como revisão opcional, cada um com 3 exercícios ainda não respondidos.
5. Em "Praticar este assunto" responda o quiz de revisão (até 3 questões inéditas do assunto, ou as ainda erradas quando não houver inéditas) e volte: as recomendações se atualizam.
6. Idempotência: `scripts/demo-replay.sh` cria uma conta descartável e envia o mesmo `requestId` duas vezes (HTTP 201 e depois 200, mesmo `attemptId`, sem duplicar respostas).
7. Na tela de resultado, toque em "Explicar meu erro" numa questão errada. Com `AI_MODE=mock` (reinicie a API com essa variável) aparece "Explicação gerada por IA"; com a IA desligada ou indisponível, "Explicação de referência". A nota nunca muda.
8. Decisões a explicar: correção determinística, transação, idempotência e IA restrita à explicação, com fallback.

Teste de resiliência no app: pare a API (`Ctrl+C`), tente enviar e veja o erro com "Tentar enviar novamente"; suba a API de novo e reenvie. O reenvio usa o mesmo `requestId`, então não duplica a tentativa.

## Segurança (resumo da revisão)

- Todas as consultas SQL são parametrizadas; entradas validadas por schema (corpo máximo de 64 KB).
- Autenticação: senhas com scrypt (sal por usuário, comparação em tempo constante, NFKC), sessões por token aleatório de 256 bits **guardado só como SHA-256**, login com erro genérico e custo constante (sem enumerar e-mails), limite de tentativas (5 erros por conta/IP e 20 por IP em 15 min; 20 cadastros por IP por hora) e `Retry-After`. Cada rota usa o aluno da sessão. Sem TLS: a API escuta só em `127.0.0.1` e recusa outro `HOST` sem `ALLOW_NON_LOOPBACK_HOST=true`. CORS só para origens `localhost`/`127.0.0.1`.
- Respostas da API com `Cache-Control: no-store` e `X-Content-Type-Options: nosniff`.
- Chave da LLM só em `.env` (ignorado pelo git); o hook de pré-commit (`scripts/check-secrets.sh`) bloqueia credenciais; os logs redigem `authorization`, `x-api-key` e cookies.
- No app, o token da sessão nunca é gravado em disco (só em memória); sair da conta encerra a sessão também no servidor, e uma sessão expirada leva de volta ao login com um aviso.
- Os testes recusam rodar `DROP SCHEMA` em qualquer banco que não seja local e terminado em `_test`.
- `npm audit --omit=dev`: 0 vulnerabilidades. O `npm audit` completo aponta 10 avisos moderados só na cadeia do ESLint (ferramenta de desenvolvimento); a correção automática exigiria rebaixar o ESLint e quebraria o lint, então foi deliberadamente não aplicada.

## Acessibilidade e usabilidade

Rótulos para leitores de tela (progresso, assunto, dificuldade, resposta correta/incorreta), alvos de toque de pelo menos 48 dp, contraste mínimo de 4,5:1 nas tags e variações em ambos os temas, layout testado com fonte a 200%, validação de formulários em português com mostrar/ocultar senha, confirmação ao sair de um simulado com respostas marcadas e plural correto nos textos.

## Qualidade

```bash
npm run lint && npm run typecheck && npm run test && npm run build   # backend (precisa do Postgres no ar)
cd mobile/flutter_app && flutter analyze && flutter test            # app
```

Os testes de integração usam o banco isolado `studypath_test` (criado pelo Docker Compose), que é recriado do zero a cada arquivo de teste. Se o volume do Postgres é anterior à criação desse banco, rode `npm run db:down -- -v` e `npm run db:up`.

## Limitações conhecidas

- A regra de prioridade é uma heurística de demonstração, sem validação pedagógica. Considerando **todas** as tentativas, conta a **última resposta de cada questão** (erros já corrigidos deixam de pesar): com >= 2 questões respondidas, < 60% de acerto é `HIGH` e de 60% a 99% é `LOW` (revisão opcional).
- O simulado tem poucas questões fixas, então repetir tentativas pode medir memorização. A tela de recomendações mostra a **evolução por tentativa** e avisa que isso não prova aprendizado; só questões novas medem isso de verdade, e o banco tem poucas (8 extras por assunto). Quando acabam, o quiz de revisão refaz as questões ainda erradas, o que a tela avisa.
- Sem recuperação de senha, confirmação de e-mail, autenticação em dois fatores ou ranking. O limite de tentativas de login fica em memória (zera ao reiniciar a API).
- O app Flutter tem apenas a plataforma web gerada; Android e iOS (`flutter create --platforms=android,ios .`) ficam para a etapa de testes em dispositivo.
