# Publicar o StudyPath AI (grátis)

Resultado: o entrevistador abre **uma URL** e usa o app. Nada de segredo vai para o navegador.

```
 Navegador ──► GitHub Pages (o app Flutter, arquivos públicos)
     │
     └──────► Render (a API, em Docker) ──► Neon (Postgres)
                      │                  └──► Render Key Value (Redis, fila)
                      └──► Groq (IA)
```

**Onde ficam os segredos:** a chave do Groq, a senha do banco, o código de convite e a senha da professora
ficam **só** nas variáveis de ambiente da API (painel do Render). O app publicado só conhece a URL da API,
que é pública por natureza. Tudo que entra num app web, até via "secret" do GitHub, qualquer um consegue ler.

## O que você vai precisar

- Conta no [GitHub](https://github.com) (você já tem), [Neon](https://neon.com) e [Render](https://render.com). Entre com o GitHub nos dois.
  O Render pode pedir um cartão para verificar a conta, mesmo no plano grátis. Confira ao criar.
- Uma chave do Groq **só para a publicação** ([console.groq.com](https://console.groq.com) > API Keys > Create). Use outra, diferente da do seu computador:
  se algo vazar, você revoga só ela.
- Escolha, e guarde num gerenciador de senhas, um **código de convite novo** (8+ caracteres) e uma **senha nova** para a professora.
  Não reutilize os exemplos do README (`professora123`, `stift-demo-2026`): eles são públicos.

## Passo 1: enviar o código (já feito se o `git push` está em dia)

O Render e o GitHub Pages leem o repositório. Confirme em `github.com/leandropiassetta/studypath_ai` que existem `Dockerfile` e `render.yaml`.

## Passo 2: banco no Neon (5 min)

1. Neon > **Create project**. Nome: `studypath`. Região: **São Paulo (sa-east-1)** se aparecer; senão a mais próxima.
2. Na tela do projeto, **Connection string** (opção "Direct", não "Pooled") > copie. Parece com
   `postgresql://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require`.
3. Se depois der erro de conexão mencionando `channel_binding`, apague `&channel_binding=require` do final da string.

Não rode migração nenhuma: a API cria as tabelas e as questões sozinha ao iniciar.

## Passo 3: API e Redis no Render (10 min)

1. Render > **New** > **Blueprint** > escolha o repositório `studypath_ai`. Ele lê o `render.yaml` e propõe dois recursos:
   `studypath-api` (web) e `studypath-redis` (Key Value), ambos **Free**.
2. Preencha as variáveis que o Render pedir (as marcadas `sync: false`):

| Variável              | Valor                                                     |
| --------------------- | --------------------------------------------------------- |
| `DATABASE_URL`        | a string do Neon (passo 2)                                |
| `LLM_API_KEY`         | a chave nova do Groq                                      |
| `TEACHER_INVITE_CODE` | o código de convite novo                                  |
| `TEACHER_EMAIL`       | o e-mail da professora (pode ser fictício)                |
| `TEACHER_PASSWORD`    | a senha **nova** da professora                            |
| `ALLOWED_ORIGINS`     | `https://leandropiassetta.github.io` (sem barra no final) |

3. **Apply**. O primeiro deploy leva uns 5 minutos. Quando ficar **Live**, copie a URL do serviço, algo como
   `https://studypath-api-xxxx.onrender.com`.
4. Teste no navegador: `https://studypath-api-xxxx.onrender.com/health` deve mostrar `{"status":"ok"}`.
   (Se ele estava dormindo, a primeira resposta demora cerca de 1 minuto.)

## Passo 4: o app no GitHub Pages (5 min)

1. No repositório: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. **Settings > Secrets and variables > Actions > aba Variables > New repository variable**:
   nome `API_BASE_URL`, valor = a URL do Render, **sem barra no final** e começando com `https://`.
   (É uma _variável_, não um _secret_: a URL é pública.)
3. **Actions > "Publicar o app (GitHub Pages)" > Run workflow**. Em 3 a 5 minutos aparece a URL:
   **`https://leandropiassetta.github.io/studypath_ai/`**. É esta que você entrega.

A partir daí, cada `git push` que mexer em `mobile/` republica o app sozinho.

## Passo 5: conferir (cole esta lista antes de entregar)

- [ ] Abrir a URL do Pages: o app carrega e, se o servidor dormia, mostra "Acordando o servidor…" e depois libera o login.
- [ ] Criar uma conta de aluno, fazer um simulado, pedir uma dica (deve vir marcada **IA**) e chamar a professora.
- [ ] Entrar com a professora (e-mail e senha **que você escolheu**) em outra aba e responder.
- [ ] A professora do README (`professora@exemplo.dev` / `professora123`) **não** deve entrar (401).
- [ ] No cadastro, "Sou professor" só funciona com o **seu** código de convite.

## No dia da entrevista

- **Acorde o servidor 5 minutos antes**: abra a URL do Pages (ou `/health` da API). O plano grátis do Render dorme após
  15 minutos sem acesso e leva cerca de 1 minuto para voltar. O app avisa, mas é melhor não precisar.
- Se quiser que ele nunca durma, um monitor gratuito (por exemplo, UptimeRobot) chamando `/health` a cada 5 minutos resolve.
  Isso consome as 750 horas grátis do mês (um serviço ligado o mês inteiro usa 744).
- O Postgres do Neon também "cochila" após alguns minutos parado e volta em cerca de 1 segundo. O Redis grátis perde os dados ao reiniciar:
  só o resumo de equívoco e o alerta de prazo são afetados, e o app continua funcionando.
- A IA tem teto: 20 chamadas por aluno por dia e 300 no total (`AI_MAX_CALLS_*` no painel). Acima disso o app mostra o texto de referência.

## Cuidados com um site público

- **Não coloque dados reais de pessoas.** É uma demonstração; qualquer um pode criar conta de aluno.
- Para tirar do ar: Render > serviço > **Suspend**. Para trocar uma credencial: mude a variável no painel (a API reinicia sozinha).
- Se a chave do Groq vazar: revogue em console.groq.com e crie outra. O seu computador não é afetado, porque usa uma chave diferente.

## Problemas comuns

| Sintoma                                                      | Causa provável                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Página em branco no Pages                                    | o app foi compilado com outro `--base-href`; rode o workflow de novo, sem mudar o nome do repositório              |
| Login dá "Não foi possível conectar"                         | `ALLOWED_ORIGINS` diferente da origem do Pages (barra no final, `http` em vez de `https`) ou `API_BASE_URL` errada |
| `/health` demora e depois funciona                           | o servidor estava dormindo (normal no plano grátis)                                                                |
| API não sobe e o log fala de SSL ou `channel_binding`        | veja o passo 2, item 3                                                                                             |
| Todos os usuários são bloqueados juntos nos limites de login | `TRUST_PROXY=1` ausente (o `render.yaml` já define)                                                                |
| "Fila indisponível" no log                                   | o Redis não está no mesmo workspace/região; recrie pelo blueprint                                                  |
