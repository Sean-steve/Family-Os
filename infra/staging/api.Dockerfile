# API contains no Vite SPA, family demo data, admin credentials or source-control metadata.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY server ./server
RUN ./node_modules/.bin/tsc -p server/tsconfig.build.json
RUN mkdir -p dist-server/migrations && cp server/migrations/*.sql dist-server/migrations/
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist-server ./dist-server
USER node
EXPOSE 3001
CMD ["node","dist-server/src/index.js"]
