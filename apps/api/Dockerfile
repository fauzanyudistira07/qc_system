FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

# Salin package manifest untuk layer caching
COPY package*.json ./
COPY packages/flow-schema/package*.json ./packages/flow-schema/
COPY apps/api/package*.json ./apps/api/

# Install dependencies monorepo
RUN npm install

# Salin source code
COPY packages/flow-schema ./packages/flow-schema
COPY apps/api ./apps/api

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV QC_API_PORT=4100
ENV QC_API_HOST=0.0.0.0

EXPOSE 4100

CMD ["npx", "tsx", "src/server.ts"]
