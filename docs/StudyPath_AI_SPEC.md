# StudyPath AI | Especificação técnica SDD

**Versão:** 1.0  
**Data:** 05/11/2026  
**Status:** pronta para implementação guiada por agente  
**Objetivo:** MVP demonstrável de simulados, diagnóstico de dificuldades e recomendações de estudo.  
**Prazo de referência:** primeiro ciclo de implementação de 4 a 6 horas; escopo P0 vem antes de IA real.

## 0. Instruções para o agente de programação

Leia todo este documento antes de alterar arquivos. Trate esta especificação como a fonte de verdade. Não acrescente microsserviços, filas, autenticação real, RAG, funcionalidades pedagógicas ou bibliotecas não previstas sem justificar e pedir aprovação. Execute **uma tarefa por vez**, na ordem da seção 12. Antes de cada tarefa, apresente (a) plano curto, (b) arquivos afetados e (c) testes que provarão a conclusão. Após implementar, execute testes, lint e typecheck relevantes, informe o resultado real, a lista de arquivos alterados e as decisões tomadas. Se um requisito for ambíguo, escolha a alternativa mais simples que preserve os critérios de aceite e registre a hipótese. Nunca marque como concluído algo que não foi testado.

## 1. Problema, objetivos e métricas

**Problema:** alunos realizam simulados, mas uma nota isolada não indica quais temas revisar nem quais exercícios praticar em seguida.

**Hipótese de produto:** identificar temas com baixa taxa de acerto e sugerir questões relacionadas ajudará o aluno a estudar de forma mais direcionada.

**Jornada P0:** abrir simulado -> responder 8 questões -> enviar respostas -> receber nota e desempenho por assunto -> consultar até 3 exercícios sugeridos por assunto prioritário.

**Objetivos mensuráveis do MVP:**

- Corrigir 100% das submissões válidas usando exclusivamente gabaritos armazenados e validados.
- Retornar o mesmo resultado para uma retransmissão idêntica com o mesmo `requestId`.
- Exibir recomendações calculadas a partir do histórico registrado, sem depender de LLM.
- Cobrir regras centrais com testes automatizados e executar uma demonstração ponta a ponta.

**Métricas futuras de produto, não metas comprovadas:** conclusão de simulados, uso de recomendações, melhora da taxa de acertos por tema e retenção de estudo em sete dias. Não afirmar eficácia pedagógica sem experimento.

## 2. Escopo e prioridades

### P0: obrigatório e demonstrável sem chave de IA

1. Banco PostgreSQL com migrations e dados fictícios (seed).
2. API Fastify/TypeScript para listar simulado, registrar tentativa e obter recomendações.
3. Correção determinística e persistência transacional.
4. Idempotência da submissão.
5. Aplicativo Flutter com telas de simulado, resultado e recomendações, mais estados de loading/erro.
6. Testes unitários e de integração; README com instruções reproduzíveis.

### P1: extensão após P0 estar funcionando

7. Explicação personalizada dos erros usando LLM por interface de provedor, com modo `mock`, timeout e fallback para explicação de referência.
8. Refinamento de interface e testes de widget Flutter.

### Fora do escopo

Login real, cadastro, pagamentos, ranking, notificações, painel administrativo, upload de PDF, RAG, agentes autônomos, geração automática de questões, mensageria, microsserviços, deploy público e avaliação formal de aprendizagem. As recomendações listam exercícios para estudo, mas **responder esses novos exercícios em uma sessão própria** fica para evolução futura.

## 3. Stack e princípios

- **Backend:** Node.js LTS, TypeScript com `strict: true`, Fastify, schemas de validação com TypeBox, TypeORM e PostgreSQL.
- **Testes backend:** Vitest, `fastify.inject()` e PostgreSQL de teste isolado.
- **Mobile:** Flutter/Dart, pacote `http`, gerenciamento simples de estado com `setState` no MVP.
- **Ambiente:** Docker Compose para PostgreSQL; `.env.example` sem segredos.
- **Qualidade:** ESLint, Prettier, migrations versionadas, logs estruturados, README.
- **Arquitetura:** monólito modular com camadas `routes -> services -> repositories`; regras de domínio independentes da API e do ORM.

**Decisões arquiteturais:**

- Não usar LLM para corrigir questões ou calcular prioridades: o resultado deve ser reproduzível e testável.
- Não criar fila no P0: o processamento é pequeno e síncrono. Considerar fila apenas se tarefas demoradas se tornarem reais.
- Separar banco de questões de simulados: uma questão pode ser incluída em diversos simulados.
- Usar apenas usuário fictício e acesso local: autenticação real é obrigatória antes de qualquer implantação pública.

## 4. Modelo de dados

Todas as chaves primárias usam UUID. Datas usam `timestamptz` em UTC. Criar índices para FKs e consultas mais frequentes.

| Entidade          | Campos essenciais                                                                                                        | Restrições                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `students`        | `id`, `name`, `created_at`                                                                                               | PK `id`                                                                 |
| `topics`          | `id`, `name`, `created_at`                                                                                               | `name` único                                                            |
| `quizzes`         | `id`, `slug`, `title`, `is_active`, `created_at`                                                                         | `slug` único                                                            |
| `questions`       | `id`, `topic_id`, `statement`, `options` (jsonb), `correct_option`, `difficulty`, `reference_explanation`, `created_at`  | FK topic; opção correta existente no JSON; difficulty: easy/medium/hard |
| `quiz_questions`  | `quiz_id`, `question_id`, `position`                                                                                     | PK composta (`quiz_id`, `question_id`); unique (`quiz_id`, `position`)  |
| `attempts`        | `id`, `student_id`, `quiz_id`, `request_id`, `payload_hash`, `correct_count`, `total_count`, `score_pct`, `submitted_at` | unique (`student_id`, `request_id`)                                     |
| `attempt_answers` | `id`, `attempt_id`, `question_id`, `selected_option`, `is_correct`                                                       | unique (`attempt_id`, `question_id`)                                    |

**Formato de `options`:** array ordenado `[{"key":"A","text":"..."}, {"key":"B","text":"..."}]`; chave de alternativa única por questão. `correct_option` permanece apenas no banco e na resposta após submissão.

**Seed P0:** um aluno fictício de ID estável (documentado no README); dois assuntos (`Equações` e `Geometria`); um simulado ativo `demo-matematica` de 8 questões, 4 por assunto; pelo menos 3 questões extras não incluídas nesse simulado para cada assunto. Dados não devem reproduzir material protegido de terceiros.

## 5. Regras de negócio

**RN-01. Listagem:** retornar somente questões vinculadas ao simulado ativo, ordenadas por `position`; nunca expor `correct_option` nem `reference_explanation` antes da entrega.

**RN-02. Validação da tentativa:** aceitar exatamente uma resposta para cada questão do simulado, sem duplicatas e sem questões externas; `selectedOption` deve existir nas alternativas. Não aceitar tentativa vazia ou parcial. Em erro de entrada, responder HTTP 400.

**RN-03. Correção:** comparar `selectedOption` com `correct_option` armazenada. `correctCount = soma(isCorrect)`; `totalCount = número de questões`; `scorePct = round(correctCount / totalCount * 100, 2)`.

**RN-04. Atomicidade:** inserir tentativa e respostas em uma única transação. Se qualquer etapa falhar, não persistir tentativa parcial.

**RN-05. Idempotência:** o cliente gera um `requestId` UUID por intenção de envio e reutiliza esse ID ao repetir o envio após timeout. Persistir hash SHA-256 do payload canônico (quizId e lista de respostas ordenadas por questionId). Mesmo estudante + `requestId` + mesmo payload retorna a tentativa já criada (HTTP 200). Mesmo estudante + `requestId` + payload diferente retorna HTTP 409. Primeira submissão retorna HTTP 201. Tratar também corrida concorrente por índice único e releitura da tentativa vencedora.

**RN-06. Histórico para recomendação:** agrupar respostas das **cinco tentativas mais recentes** do aluno, de qualquer simulado, por tema. Tentativas repetidas com IDs diferentes são tentativas distintas.

**RN-07. Prioridade:** somente temas com `answeredCount >= 2` e pelo menos um erro são recomendados. Com `accuracy = correctCount / answeredCount < 0.60` a prioridade é `HIGH`; com `0.60 <= accuracy < 1.00` é `LOW` (revisão opcional). Temas `HIGH` vêm antes dos `LOW`; dentro de cada prioridade, ordenar por taxa de acerto crescente, quantidade de respostas decrescente e nome do tema crescente. Regra heurística de MVP, não diagnóstico pedagógico validado. *(Revisão pós-T09: a faixa `LOW` foi acrescentada para que quem erra algumas questões sem cair abaixo de 60% não fique sem próximo passo.)*

**RN-08. Seleção de exercícios:** para cada tema prioritário, sugerir até 3 questões que o aluno **nunca respondeu**, independentemente do simulado. Ordenar por dificuldade (`easy`, `medium`, `hard`), data de criação e ID. Não enviar gabarito. Sem questões disponíveis, retornar o tema com `status: NO_NEW_QUESTIONS`, lista vazia e mensagem de revisão.

**RN-09. Estados especiais:** sem tentativas -> `NO_HISTORY`; com histórico, mas sem nenhum tema a revisar (sem erros em temas elegíveis) -> `ON_TRACK`; com algum tema `HIGH` ou `LOW` -> `NEEDS_REVIEW`.

**RN-10. Modo demo:** endpoint de estudante só aceita o ID fictício configurado; outros IDs recebem HTTP 403. A API deve ouvir `127.0.0.1` por padrão. Em produção pública, substituir por autenticação/autorização apropriadas.

**RN-11. IA P1:** nunca permitir que a LLM altere nota, gabarito, histórico ou prioridade. Usar enunciado como dado não confiável, limite de tamanho e saída estruturada. Em timeout, erro ou saída inválida, retornar `reference_explanation` com `source: "reference"`.

## 6. Contratos HTTP

Base: `/api/v1`. JSON em todas as respostas. Datas ISO 8601. Identificadores UUID. Erros padronizados:

```json
{ "error": { "code": "INVALID_ANSWERS", "message": "Respostas inválidas", "details": [] } }
```

### `GET /api/v1/quizzes/:slug` (P0)

Exemplo `GET /api/v1/quizzes/demo-matematica`.

**200:**

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "slug": "demo-matematica",
  "title": "Simulado de Matemática",
  "questions": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "topic": { "id": "33333333-3333-4333-8333-333333333333", "name": "Equações" },
      "statement": "Quanto é x se x + 2 = 5?",
      "options": [
        { "key": "A", "text": "2" },
        { "key": "B", "text": "3" },
        { "key": "C", "text": "5" }
      ],
      "difficulty": "easy"
    }
  ]
}
```

**404:** simulado não existe ou está inativo. Não incluir gabarito na saída.

### `POST /api/v1/attempts` (P0)

**Body:**

```json
{
  "requestId": "44444444-4444-4444-8444-444444444444",
  "studentId": "55555555-5555-4555-8555-555555555555",
  "quizId": "11111111-1111-4111-8111-111111111111",
  "answers": [{ "questionId": "22222222-2222-4222-8222-222222222222", "selectedOption": "B" }]
}
```

Body ilustrativo abreviado: a requisição válida deve responder às 8 questões. **201** na criação e **200** na repetição idêntica:

```json
{
  "attemptId": "66666666-6666-4666-8666-666666666666",
  "quizId": "11111111-1111-4111-8111-111111111111",
  "correctCount": 4,
  "totalCount": 8,
  "scorePct": 50,
  "topicResults": [
    {
      "topicId": "33333333-3333-4333-8333-333333333333",
      "topicName": "Equações",
      "correctCount": 1,
      "totalCount": 4,
      "accuracyPct": 25
    }
  ],
  "answers": [
    {
      "questionId": "22222222-2222-4222-8222-222222222222",
      "selectedOption": "B",
      "correctOption": "B",
      "isCorrect": true,
      "referenceExplanation": "..."
    }
  ]
}
```

**400:** JSON, UUID, alternativa ou conjunto de questões inválidos. **403:** estudante não autorizado no modo demo. **404:** aluno ou simulado inexistente. **409:** `requestId` reutilizado com conteúdo diferente.

### `GET /api/v1/students/:studentId/recommendations` (P0)

**200 com dificuldades:**

```json
{
  "studentId": "55555555-5555-4555-8555-555555555555",
  "status": "NEEDS_REVIEW",
  "evaluatedAttempts": 1,
  "topics": [
    {
      "topicId": "33333333-3333-4333-8333-333333333333",
      "topicName": "Equações",
      "priority": "HIGH",
      "correctCount": 1,
      "answeredCount": 4,
      "accuracyPct": 25,
      "status": "AVAILABLE",
      "suggestedQuestions": [
        {
          "id": "77777777-7777-4777-8777-777777777777",
          "statement": "...",
          "options": [{ "key": "A", "text": "..." }],
          "difficulty": "easy"
        }
      ]
    }
  ]
}
```

Sem histórico, devolver `status: "NO_HISTORY"`, `evaluatedAttempts: 0`, `topics: []`; sem erros a revisar devolve `ON_TRACK`, `topics: []`. Cada tópico traz `priority: "HIGH" | "LOW"`. **403** para outro aluno no modo demo.

### `GET /health` (P0)

**200** `{"status":"ok"}` se API e DB estiverem disponíveis; **503** caso contrário, sem expor detalhes de infraestrutura.

### `POST /api/v1/attempts/:attemptId/explanations` (P1)

**Body:** `{"questionId":"<UUID>"}`. Só admite questão respondida incorretamente naquela tentativa do aluno demo. **200:** `{"questionId":"...","explanation":"...","source":"llm"}`; em falha controlada, `source: "reference"`. **400** questão não incorreta; **403/404** conforme acesso e existência. Não persiste texto produzido pela LLM no P1.

## 7. Organização de código

```text
studypath-ai/
  backend/
    src/
      app.ts                 # cria instância Fastify, sem abrir porta
      server.ts              # inicialização e listen
      config/
      database/{entities,migrations,seeds}/
      modules/
        quizzes/{routes,service,repository,schemas}/
        attempts/{routes,service,repository,schemas}/
        recommendations/{routes,service,repository,domain,schemas}/
        ai/{routes,service,providers}/     # P1
      shared/{errors,logging}/
    tests/{unit,integration}/
  mobile/flutter_app/
    lib/{models,services,screens,widgets}/
    test/
  docker-compose.yml
  .env.example
  README.md
  StudyPath_AI_SPEC.md
```

Não criar abstrações genéricas sem necessidade: classes e interfaces só quando representarem uma responsabilidade ou uma fronteira útil. Serviços de domínio puros para correção e seleção de recomendações.

## 8. Requisitos não funcionais

- **Consistência:** correção e persistência na mesma transação; sem dados parciais.
- **Segurança:** validação de entrada, queries parametrizadas via ORM, sem gabarito no GET, sem chave de LLM ou string de conexão no repositório, sem dados reais de estudantes.
- **Privacidade:** usar exclusivamente dados fictícios no demo; não logar respostas completas, credenciais ou prompts com informações pessoais.
- **Observabilidade:** logs estruturados com `requestId`, método, caminho, status e duração; erro 500 genérico para o cliente e detalhes apenas em log servidor.
- **Desempenho (alvos locais, não SLOs prometidos):** sem chamadas de IA no P0; GET simulado, POST tentativa e GET recomendações devem concluir em menos de 500 ms em ambiente local aquecido, salvo limites do computador.
- **Resiliência:** Flutter mostra loading/erro e permite retry; retry de POST reutiliza `requestId` original; P1 retorna explicação de referência se LLM falhar.
- **Manutenibilidade:** TypeScript strict, lint, formatação, migrations e testes reproduzíveis.
- **Configuração:** `DATABASE_URL`, `PORT`, `APP_ENV=demo`, `DEMO_STUDENT_ID`, `AI_MODE=disabled|mock|real`, `LLM_API_KEY` (P1), `LLM_MODEL` (P1), `API_BASE_URL` (Flutter via `--dart-define`).
- **Deploy:** P0 exclusivamente local; sem reivindicar prontidão para produção pública sem autenticação, proteção de abuso, gestão de segredos e verificações adicionais.

## 9. Critérios de aceite em formato Given/When/Then

- **CA-01:** Dado o simulado ativo, quando `GET /quizzes/demo-matematica`, então recebe 8 questões ordenadas e nenhum gabarito.
- **CA-02:** Dadas respostas corretas e incorretas válidas, quando `POST /attempts`, então nota e `isCorrect` correspondem ao gabarito e ficam persistidos.
- **CA-03:** Dada uma submissão com uma questão ausente ou duplicada, então a API devolve 400 e não grava tentativa.
- **CA-04:** Dado `requestId` já processado, quando o mesmo payload chega de novo, então devolve o mesmo `attemptId` com HTTP 200 e não duplica respostas.
- **CA-05:** Dado `requestId` reutilizado com respostas diferentes, então devolve HTTP 409 e não altera a tentativa original.
- **CA-06:** Dado aluno com 1 acerto em 4 questões de Equações e 3 em 4 de Geometria, então recomenda Equações como prioridade HIGH e não marca Geometria como HIGH (Geometria, com 75%, aparece como `LOW`, revisão opcional).
- **CA-07:** Dado histórico sem tentativas, então GET recomendações retorna `NO_HISTORY` e lista vazia.
- **CA-08:** Dado tema prioritário sem novas questões, então retorna `NO_NEW_QUESTIONS` sem inventar exercícios.
- **CA-09:** Dado estudante que não é o aluno fictício autorizado, então POST tentativa e GET recomendações retornam 403.
- **CA-10:** Dada falha na API, Flutter exibe erro e permite tentar novamente; para POST, usa o mesmo `requestId`.
- **CA-11 (P1):** Dada indisponibilidade da LLM, a explicação de referência é devolvida sem afetar nota ou recomendações.

## 10. Plano de testes

**Unitários:** (1) correção 0%, 50%, 100%; (2) arredondamento; (3) seleção de temas com limite 60%; (4) tema com amostra inferior a 2; (5) ordenação estável; (6) exclusão de questões já respondidas; (7) sem exercícios novos; (8) hash canônico de submissões com respostas em ordens diferentes.

**Integração com PostgreSQL isolado:** (9) GET sem gabarito; (10) POST válido persiste tentativa e respostas; (11) POST parcial/duplicado não persiste; (12) replay idêntico 200; (13) replay divergente 409; (14) rollback em falha de persistência; (15) recomendações refletem respostas gravadas; (16) autorização restrita ao aluno demo. Testes com dados de banco descartáveis.

**Flutter:** testes de widget para (17) exibição das questões e seleção de alternativa; (18) tela de loading/erro; (19) resultado e recomendação. Teste manual com API local de ponta a ponta.

**P1:** (20) saída válida da IA; (21) timeout; (22) retorno inválido; (23) fallback seguro; (24) nenhuma alteração em nota ou gabarito.

## 11. Definition of Done (DoD)

P0 só está concluído quando: `docker compose up -d` inicia PostgreSQL; migrations aplicam do zero; seed cria dados; API inicia; os três endpoints principais funcionam; Flutter permite realizar um simulado e visualizar resultado/recomendações; lint, typecheck, build e testes executam sem falhas; README documenta exatamente como executar e demonstrar; nenhum dado secreto está versionado. Cada etapa deve preservar o que já funciona.

## 12. Backlog sequenciado para Claude Code ou Cursor

| ID  | Prioridade | Tarefa                                                                              | Entregável e evidência                                                |
| --- | ---------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| T01 | P0         | Criar workspace, `backend`, scripts, configs TypeScript strict, lint e testes       | API vazia inicia; scripts `lint`, `typecheck`, `test`, `build` passam |
| T02 | P0         | Configurar Postgres Docker, TypeORM e migrations                                    | Container saudável; migration em banco vazio aplica sem erro          |
| T03 | P0         | Criar 7 entidades, índices e seed determinístico                                    | 8 questões no simulado + 6 extras; banco coerente                     |
| T04 | P0         | Implementar GET simulado e GET health                                               | Teste de integração; JSON sem gabarito                                |
| T05 | P0         | Implementar correção pura e POST tentativas com transação                           | Testes unitários de nota e integração de persistência/validação       |
| T06 | P0         | Implementar idempotência robusta e retry seguro                                     | Casos 200, 201, 409 e corrida de requests cobertos                    |
| T07 | P0         | Implementar motor de recomendações e endpoint                                       | Caso 1/4 em Equações; fallback sem questões; testes                   |
| T08 | P0         | Criar Flutter com telas e cliente HTTP configurável                                 | Fluxo real de simulado, resultado e recomendações                     |
| T09 | P0         | Tratar erros/loading/retry Flutter, revisar testes e README                         | Demonstração ponta a ponta documentada                                |
| T10 | P1         | Criar provedor de LLM (`mock`/`real`), endpoint de explicação, validação e fallback | Testes de sucesso, timeout e falhas, sem afetar gabarito              |
| T11 | P1         | Melhorias de UI e testes de widget                                                  | Navegação e estados comprovados                                       |

**Regra de execução:** não iniciar T(n+1) até que T(n) esteja implementada, verificada e apresentada para revisão. Se não houver tempo, parar após T09: P0 completo vale mais que P1 incompleto.

## 13. Roteiro de demonstração de 3 minutos

1. Abrir Flutter e mostrar o simulado com oito questões.
2. Responder intencionalmente 1/4 em Equações e 3/4 em Geometria.
3. Enviar e mostrar 50% de acerto, correção por questão e resumo por tema.
4. Mostrar a recomendação de Equações, inclusive questões ainda não respondidas.
5. Repetir o POST com mesmo `requestId` e comprovar que não há duplicação.
6. Explicar as decisões: cálculo determinístico, transações, idempotência e IA restrita à explicação.
7. Se T10 concluída, mostrar explicação por LLM e fallback; caso contrário, declarar como próxima evolução.

## 14. Riscos, limitações e próximas decisões

- A regra de 60% com pelo menos 2 respostas é uma **heurística de demonstração**, não evidência de domínio real. Validar com especialistas e dados de aprendizagem antes de usar em escala.
- Não há autenticação real: **não colocar essa API publicamente acessível**.
- O aluno vê recomendações, mas ainda não inicia uma sessão dedicada para respondê-las. Evolução natural: gerar quiz de revisão e medir taxa de acerto posterior.
- Não há controle de dificuldade adaptativo, curadoria formal das questões nem estudo longitudinal.
- IA real depende de credenciais, custos, testes e avaliação factual da explicação.

## 15. Prompt inicial para o agente

> Leia `StudyPath_AI_SPEC.md` integralmente e trate o documento como contrato. Antes de codificar, faça um resumo de arquitetura e identifique inconsistências ou decisões que exigiriam alteração no escopo. Depois implemente **somente a tarefa T01**, com mudanças pequenas, testes e verificação por comandos executados. Ao finalizar, reporte arquivos alterados, comandos e resultados, limitações e próxima tarefa. Não implemente T02 sem minha autorização.
