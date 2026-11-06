# StudyPath AI

[![CI](https://github.com/leandropiassetta/studypath_ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/leandropiassetta/studypath_ai/actions/workflows/ci.yml)

MVP de simulados, diagnóstico de dificuldades e recomendações de estudo. A especificação oficial (SDD) é mantida localmente em `docs/StudyPath_AI_SPEC.md` e **não é versionada** (`docs/` está no `.gitignore`).

**Estado:** P0 (T01–T09) e P1 (T10 explicações por LLM com fallback; T11 melhorias de UI) completos, mais assuntos, dúvidas com dicas graduais, fila do professor e tarefas em segundo plano. Roda no navegador; o Android foi validado manualmente uma vez em emulador (sem testes automatizados em dispositivo) e o iOS não foi executado. A integração contínua (`.github/workflows/ci.yml`) roda lint, tipos, build, testes e auditoria da API, e análise e testes do app. **Decisões, limitações conhecidas e rastreabilidade dos testes: [DECISIONS.md](DECISIONS.md).**

> **Uso local.** Há cadastro e login reais (senha com scrypt, sessão por token), mas a API fala HTTP puro, sem TLS, e escuta só em `127.0.0.1`. Não a exponha publicamente sem um proxy HTTPS. Todos os dados de exemplo são fictícios.

## Como funciona

- **Backend** (`backend/`): Node.js + Fastify + TypeScript strict, TypeORM, PostgreSQL. Camadas `routes → service → repository`, com regras de domínio puras (correção e recomendações) e sem uso de LLM.
- **App** (`mobile/flutter_app/`): Flutter (`http` + `setState`) com cadastro/login, simulado, resultado, recomendações e quiz de revisão. A sessão fica **só em memória**: fechar o app desloga (nada é gravado em disco). Tema: um botão na barra de cima de todas as telas troca **direto** entre claro e escuro com um toque (lua para ir ao escuro, sol para voltar ao claro, sem menu); o app abre com o tema do sistema e a escolha vale enquanto estiver aberto.
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

| Método e rota                                      | Descrição                                                                                                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                                      | 200 `{"status":"ok"}` ou 503 se o banco estiver indisponível (público)                                                                                                                                                                     |
| `POST /api/v1/auth/register`                       | Cria a conta (`name`, `email`, `password` de 6 a 128 caracteres) e já abre a sessão: 201 `{token, expiresAt, student}`; 400, 409 (e-mail em uso), 429                                                                                      |
| `POST /api/v1/auth/login`                          | 200 `{token, expiresAt, student}`; 401 genérico (nunca diz se foi o e-mail ou a senha); 429 após 5 erros em 15 min                                                                                                                         |
| `POST /api/v1/auth/logout` / `GET /api/v1/auth/me` | Encerra a sessão atual (204) / dados do aluno logado                                                                                                                                                                                       |
| `GET /api/v1/quizzes/:slug`                        | Simulado ativo com questões em ordem, sem gabarito                                                                                                                                                                                         |
| `POST /api/v1/attempts`                            | Corrige e grava a tentativa: 201 criada, 200 replay, 400/403/404/409                                                                                                                                                                       |
| `POST /api/v1/students/:studentId/review-quizzes`  | Cria (ou reaproveita) um quiz de revisão de um assunto recomendado, com até 3 questões; envie as respostas em `POST /api/v1/attempts`                                                                                                      |
| `POST /api/v1/doubts`                              | Abre (ou reabre) a **dúvida** sobre uma questão errada da própria tentativa (`attemptId`, `questionId`, `message` opcional de até 300 caracteres): 201 criada, 200 já existia, 400 se a questão foi acertada, 404 se a tentativa não é sua |
| `POST /api/v1/doubts/:doubtId/hints`               | Entrega a **próxima dica** (nível 1, 2 e, por último, a solução). O servidor decide o nível; a quarta chamada dá 409                                                                                                                       |
| `GET /api/v1/doubts/:doubtId`                      | A dúvida com todas as dicas já dadas                                                                                                                                                                                                       |
| `GET /api/v1/students/:studentId/recommendations`  | Temas prioritários e até 3 exercícios inéditos por tema                                                                                                                                                                                    |

`POST /api/v1/attempts/:attemptId/explanations` com `{"questionId":"..."}` devolve `{questionId, explanation, source}`. Só aceita questões **erradas** daquela tentativa do aluno demo (400 se acertada, 403/404 conforme acesso). `source` é `llm` ou `reference`: em timeout, erro ou saída inválida da LLM volta a explicação de referência, e nota, gabarito e recomendações nunca mudam. Nada gerado pela LLM é gravado em banco. **Controle de custo (em memória, zera ao reiniciar):** a explicação de uma questão fica em cache, então cliques repetidos não geram nova chamada; pedidos simultâneos da mesma questão compartilham uma só chamada; e há limite por minuto e por 24 h. Passado o limite, a API continua respondendo 200 com a explicação de referência e um campo `notice` explicando o motivo. Chamadas que falham também contam no limite. Com `AI_MODE=mock` não há rede nem chave (resposta determinística); com `real` usa a API do provedor em `LLM_PROVIDER` (Anthropic ou OpenAI).

Erros usam `{"error":{"code","message","details"}}`; erros 500 não expõem detalhes internos.

**Todas as rotas abaixo exigem `Authorization: Bearer <token>`** (401 sem token válido). O aluno é sempre o da sessão: informar outro `studentId` no caminho ou no corpo dá 403, e a tentativa de outro aluno em `/explanations` aparece como 404.

## Tirar dúvida (dicas graduais de IA)

No resultado, cada questão errada tem **"Tirar dúvida"**. A aluna pode escrever o que não entendeu (opcional) e pedir dicas **uma de cada vez**: dica 1 (pergunta orientadora), dica 2 (próximo passo do método) e, só no fim, a solução completa.

- **A ordem é imposta pelo servidor** (a aluna não escolhe o nível), com atualização atômica: dois toques ao mesmo tempo recebem níveis diferentes.
- **Nos níveis 1 e 2 a resposta não pode vazar.** O modelo é instruído a não revelar, e a saída ainda passa por uma checagem automática (alternativa citada, "x = valor", "resultado é..."). Se vazar, falhar, expirar ou estourar o limite de uso, entra a **dica padrão** montada a partir da solução de referência da própria questão (testada para as 24 questões do seed).
- A mensagem da aluna é tratada como **dado não confiável** (limitada a 300 caracteres e isolada em `<question_data>`), então não consegue mudar o nível nem as regras.
- As dicas ficam gravadas, para reabrir a dúvida com tudo o que já foi dito.

### Chamar um professor (fila de dúvidas)

Depois das dicas, a aluna pode tocar em **"Chamar um professor"**: a dúvida entra numa fila (meta de resposta: **14 min**) e a tela se atualiza sozinha até a resposta chegar. Ela então marca **"isso ajudou?"** para as dicas da IA e para a resposta do professor.

- **Professor:** no cadastro, o seletor **"Sou aluno / Sou professor"** só cria conta de professor com um **código de convite** (`TEACHER_INVITE_CODE`, mínimo de 8 caracteres, só no ambiente, nunca no repositório). O servidor compara o código em tempo constante, limita os chutes a 5 por IP a cada 15 min, responde igual para código errado ou ausente e **desliga o cadastro de professor** se a variável não existir. Aluno não precisa de código, e quem envia `role: teacher` sem o código certo não cria nada. Também dá para criar a conta pelo seed, só com credenciais do ambiente:
  `TEACHER_EMAIL=professora@exemplo.dev TEACHER_PASSWORD=<6+ caracteres> TEACHER_NAME="Profa. Helena" npm run db:seed`
- Ao entrar com essa conta, o app abre a **fila de dúvidas** (aguardando / respondidas por mim), com o contexto pronto: a questão, o que o aluno marcou, o que escreveu, **o que a IA já disse** e a solução de referência. O professor vê só o **primeiro nome** do aluno.
- **Dois professores respondendo ao mesmo tempo:** exatamente um vence (`UPDATE` condicional); o outro recebe 409 e o app avisa.
- A área do professor (`/api/v1/teacher/*`) devolve **403 para alunos**.

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
- O simulado tem poucas questões fixas, então repetir tentativas pode medir memorização. A tela de recomendações mostra a **evolução por tentativa** e avisa que isso não prova aprendizado; só questões novas medem isso de verdade, e o banco tem poucas (4 extras por subassunto, 8 em Matemática). Quando acabam, o quiz de revisão refaz as questões ainda erradas, o que a tela avisa.
- Sem recuperação de senha, confirmação de e-mail, autenticação em dois fatores ou ranking. O limite de tentativas de login fica em memória (zera ao reiniciar a API).
- Android: validado manualmente uma vez em emulador, sem testes automatizados em dispositivo; iOS não foi executado (exige Xcode). A lista completa de limitações (limites em memória, fila sem garantia de publicação, detecção de vazamento heurística) está em [DECISIONS.md](DECISIONS.md).

## Tarefas em segundo plano (BullMQ + Redis)

Opcional: defina `REDIS_URL` (o `npm run db:up` já sobe o Redis). Ao chamar a professora, a API enfileira (1) um job que pede à IA o provável equívoco do aluno e grava em `doubts.misconception`, com 3 tentativas e espera exponencial, e frase simples como fallback; (2) um job atrasado (`SLA_DELAY_MS`, padrão 14 min) que marca `sla_breached_at` se a dúvida continua sem resposta. Jobs usam o id da dúvida como `jobId` (idempotente); se o Redis estiver fora, o pedido segue normalmente.

`LLM_BASE_URL` permite usar qualquer provedor compatível com a API da OpenAI, como o plano gratuito do Groq (ver `.env.example`).

## Assuntos (disciplinas)

O app tem um simulado por assunto, todos no mesmo formato: 8 questões, 4 em cada um de 2 subassuntos (tags), mais 4 questões extras por subassunto para as recomendações e os quizzes de revisão. Matemática (Equações e Geometria), Geografia (do Brasil e Mundial), História (do Brasil e Geral), Inglês (Vocabulário e Gramática), Ciências (Biologia e Física e Química) e Português (Ortografia e Classes de Palavras). A tela inicial do aluno lista os simulados (`GET /api/v1/quizzes`). Depois de um simulado, "Ver recomendações de estudo" mostra só aquela matéria (`GET /api/v1/students/:id/recommendations?quiz=demo-geografia`): os tópicos dela, as tentativas dela e a evolução do simulado, titulada "Sua evolução em Geografia" (nota do simulado e uma linha por subassunto). O cartão "Recomendação de estudo geral", abaixo dos simulados, mostra todas as matérias: uma evolução por matéria (cada simulado comparado só com ele mesmo) e cada subassunto com o nome da sua matéria. A evolução compara só tentativas do mesmo simulado, porque notas de simulados diferentes não são comparáveis. Cada explicação de referência segue o formato "pista: fato", e a parte antes dos dois pontos vira a dica de nível 2 sem entregar a resposta. A dica final (nível 3) é sempre a explicação de referência, escrita por pessoas: o modelo escreve só as dicas 1 e 2, e ao responder uma dúvida escrita pela aluna ele a responde primeiro, sem citar a alternativa correta. Explicações, dicas e a análise em segundo plano dividem um único orçamento de IA por aluno.
