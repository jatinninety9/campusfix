FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN npm ci --omit=dev --workspace=server --include-workspace-root=false

COPY --chown=node:node server/src ./server/src

ENV HOST=0.0.0.0
ENV PORT=4000

USER node

EXPOSE 4000

CMD ["node", "server/src/index.js"]
