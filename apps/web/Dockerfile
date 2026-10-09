# Stage 1: Build Frontend
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY apps/web ./apps/web

WORKDIR /app/apps/web
RUN npx vite build

# Stage 2: Serve via Nginx
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 4180

CMD ["nginx", "-g", "daemon off;"]
