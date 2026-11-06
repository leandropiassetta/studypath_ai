# API do StudyPath AI (Node 22). Contexto de build: a raiz do repositório.
#   docker build -t studypath-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci
COPY backend backend
RUN npm run build -w @studypath/backend

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
# Só as dependências de produção (sem TypeScript, Vitest, ESLint...).
RUN npm ci --omit=dev -w @studypath/backend && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist

# O contêiner precisa escutar fora de 127.0.0.1 para o proxy do provedor alcançá-lo. Isso só é
# aceitável atrás de um proxy HTTPS (o Render termina o TLS); a API valida essa escolha.
ENV HOST=0.0.0.0 \
    ALLOW_NON_LOOPBACK_HOST=true \
    PORT=3000
EXPOSE 3000
USER node

# Ao iniciar: aplica as migrations, garante as questões (e a conta de professor, se as variáveis
# TEACHER_* existirem) e sobe a API. As três etapas são idempotentes.
CMD ["sh", "-c", "node backend/dist/database/migrate.js run && node backend/dist/database/seeds/run.js && node backend/dist/server.js"]
