# Roteiro da demo (5 min)

Contas fictícias, só neste computador: aluna `aluna.demo@exemplo.dev` / `demo1234`, professora `professora@exemplo.dev` / `professora123`.

## Antes de começar (10 min antes)

```bash
npm run demo:setup                                   # banco, migrations, seed, contas
REDIS_URL=redis://127.0.0.1:6379 AI_MODE=mock PORT=3100 node --env-file=.env backend/dist/server.js   # API (outro terminal)
npm run demo:reset                                   # aluna volta ao estado inicial (25% → 50%)
npm run demo:check                                   # tudo deve sair verde
cd mobile/flutter_app && flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:3100
```

Abra **duas abas** do app (a sessão fica só em memória): aba 1 = aluna, aba 2 = professora.
Antes de repetir o ensaio: `npm run demo:reset`.

## Roteiro

1. **Aluna** entra e faz o simulado `demo-matematica`, errando de propósito 2–3 questões. _Fala:_ correção e prioridade são determinísticas, sem IA.
2. Resultado: evolução (25% → 50% → agora) e recomendações por tema (prioridade ALTA/BAIXA).
3. Numa questão errada, **Tirar dúvida** → escrever uma mensagem curta → **pedir dica** 3 vezes. _Fala:_ nível 1 empurra, nível 2 dá o método, nível 3 resolve; o servidor controla o nível e um detector barra dica que entrega a resposta antes da hora.
4. **Chamar professor**: aparece "fila, resposta em até ~14 min".
5. **Aba da professora**: fila (só o primeiro nome da aluna) → abrir → responder.
6. Volta à aba da aluna: a resposta chega (atualiza sozinha a cada 8 s) → **"Isso ajudou?"** para IA e para professora.

## Segundo plano (BullMQ + Redis)

Ao **Chamar professor**, a API responde na hora e coloca dois jobs na fila:

1. **Enriquecer a dúvida**: a IA resume o provável equívoco para a professora. Até 3 tentativas com espera crescente; se a IA continuar fora, grava uma frase simples ("Marcou A em vez de B") — a fila da professora nunca depende do modelo.
2. **Prazo (14 min)**: job atrasado que marca "Prazo vencido" se ninguém respondeu. Para mostrar ao vivo: suba a API com `SLA_DELAY_MS=10000`.

O id do job é o id da dúvida, então chamar duas vezes não duplica. Se o Redis cair, o pedido da aluna continua funcionando (o enfileiramento tem limite de 2 s).

## IA gratuita (Groq)

Crie uma chave grátis em console.groq.com e suba a API com `AI_MODE=real LLM_PROVIDER=openai LLM_BASE_URL=https://api.groq.com/openai LLM_MODEL=openai/gpt-oss-20b LLM_API_KEY=...` (a chave vai em variável de ambiente, nunca no repositório). O plano grátis tem limite por minuto/dia: se estourar, cai no texto de referência.

## O que dizer sobre as decisões

- IA só explica e dá dica; **nota e prioridade nunca dependem do LLM**.
- Saída do LLM é tratada como não confiável: validação de formato, timeout, fallback para o texto de referência.
- Controle de custo: limite por minuto/dia, cache, uma chamada por vez para o mesmo pedido.
- Idempotência nas tentativas (reenviar não duplica).
- Privacidade: professor vê só o primeiro nome; segredos fora do repositório; log sem token.
- Dois professores na mesma dúvida: só um vence (409 para o outro).

## Limites (diga antes que perguntem)

- A professora é simulada; a regra de 60% e de 2 respostas é uma heurística **não validada pedagogicamente**.
- Sessão do app só em memória; sem recuperação de senha.
- A fila é opcional: sem `REDIS_URL` tudo funciona igual, só sem o resumo para a professora e sem o alerta de prazo.

## Se algo der errado

| Problema                                  | Ação                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `demo:check` falha em "Docker/PostgreSQL" | Abra o Docker Desktop, `npm run db:up`, rode `demo:setup`                                           |
| API não responde                          | Reinicie o comando da API (acima); porta ocupada: `lsof -i :3100`                                   |
| Login falha                               | `npm run demo:setup` (recria as contas)                                                             |
| IA real lenta ou fora do ar               | Sem pânico: cai sozinho no texto de referência. Para ficar previsível suba a API com `AI_MODE=mock` |
| Aluna "já tem dúvida" ou estado sujo      | `npm run demo:reset`                                                                                |
| App web quebrou                           | Pare e rode `flutter run -d chrome ...` de novo (o `flutter build web` também funciona)             |
| Nada funciona                             | Mostre o código e rode `npm test` (262 testes) e `flutter test` (136)                               |

## Perguntas para a Stift

- Como vocês medem se a dica da IA ajudou (e não só deu a resposta)?
- O que acontece quando o professor não responde em 14 min?
- Como lidam com dados de menores (LGPD) nos prompts enviados ao LLM?
