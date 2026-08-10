FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY angular.json tsconfig*.json server.js words.js ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

ENV PORT=3111 NODE_ENV=production DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 3111

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3111/healthz >/dev/null || exit 1

CMD ["node", "server.js"]
