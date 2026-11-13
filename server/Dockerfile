FROM node:24-alpine

WORKDIR /app

COPY --chmod=0644 package.json package-lock.json ./
COPY --chmod=0644 server/package.json ./server/package.json
COPY --chmod=0644 client/package.json ./client/package.json

RUN npm ci --omit=dev --workspace=server --include-workspace-root=false

COPY --chown=node:node server/src ./server/src

# COPY's mode also affects newly created parent directories; they need traversal.
RUN chmod 0755 /app/server /app/client

ENV HOST=0.0.0.0
ENV PORT=4000

USER node

EXPOSE 4000

CMD ["node", "server/src/index.js"]
