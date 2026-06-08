FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG DATABASE_URL=postgresql://maintenance:maintenance@localhost:5432/maintenance_system?schema=public
ARG DEMO_MODE=true
ARG JWT_SECRET=local-preview-maintenance-secret-change-before-production
ARG APP_BASE_URL=http://localhost:3000
ENV DATABASE_URL=$DATABASE_URL
ENV DEMO_MODE=$DEMO_MODE
ENV JWT_SECRET=$JWT_SECRET
ENV APP_BASE_URL=$APP_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://maintenance:maintenance@localhost:5432/maintenance_system?schema=public
ENV DEMO_MODE=true
ENV JWT_SECRET=local-preview-maintenance-secret-change-before-production
ENV APP_BASE_URL=http://localhost:3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/docs ./docs
RUN mkdir -p storage/uploads storage/backups
EXPOSE 3000
CMD ["npm", "run", "start"]
