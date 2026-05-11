ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /app

# --- deps
FROM base AS deps
COPY package.json ./
# pnpm lockfile is checked in once installed locally; tolerate either presence
COPY pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# --- dev
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--port", "3000", "--hostname", "0.0.0.0"]

# --- build
FROM deps AS build
COPY . .
RUN pnpm build

# --- prod
FROM node:${NODE_VERSION} AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
