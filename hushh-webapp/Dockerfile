# Install dependencies only when needed
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM node:22-alpine AS builder
WORKDIR /app

# Accept build arguments for environment variables needed at build time
# Note: Sensitive values should be passed at runtime, not baked into the image
ARG DATABASE_URL
ARG RECAPTCHA_SITE_KEY
ARG RECAPTCHA_SECRET_KEY
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID

# Set environment variables for build
ENV DATABASE_URL=$DATABASE_URL
ENV RECAPTCHA_SITE_KEY=$RECAPTCHA_SITE_KEY
ENV RECAPTCHA_SECRET_KEY=$RECAPTCHA_SECRET_KEY
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID

COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma client (outputs to prisma/generated/client)
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy only necessary files
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy Prisma files (schema + generated client + config)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Set correct permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime environment variables are passed via:
# - docker run -e VAR=value
# - docker-compose.yml environment section
# - Azure App Service Application Settings
# 
# Required runtime env vars:
# - DATABASE_URL
# - ADMIN_EMAIL
# - ADMIN_USERNAME
# - ADMIN_PASSWORD
# - EMAIL_SENDER
# - EMAIL_PASSWORD
# - SMTP_SERVER
# - SMTP_PORT
# - RECAPTCHA_SITE_KEY
# - RECAPTCHA_SECRET_KEY
# - CSRF_PROTECTION

CMD ["npm", "start"]