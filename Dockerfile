FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_AGENT_API_BASE_URL=""
ARG VITE_AGENT_SITE_ID="lecrowndevelopment.com"
ARG VITE_AGENT_BOT_ID="benjamin-lagrone"

ENV VITE_AGENT_API_BASE_URL=$VITE_AGENT_API_BASE_URL
ENV VITE_AGENT_SITE_ID=$VITE_AGENT_SITE_ID
ENV VITE_AGENT_BOT_ID=$VITE_AGENT_BOT_ID

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
