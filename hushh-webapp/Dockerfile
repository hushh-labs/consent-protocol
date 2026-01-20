# Multi-stage build for Next.js Standalone
# Optimized for Google Cloud Run (Node.js)

# Stage 1: Build Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (include devDeps for build)
RUN npm ci

# Copy application code
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_REVIEW_MODE
ARG NEXT_PUBLIC_REVIEWER_EMAIL
ARG NEXT_PUBLIC_REVIEWER_PASSWORD

# Set environment variables for build
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_APP_REVIEW_MODE=$NEXT_PUBLIC_APP_REVIEW_MODE
ENV NEXT_PUBLIC_REVIEWER_EMAIL=$NEXT_PUBLIC_REVIEWER_EMAIL
ENV NEXT_PUBLIC_REVIEWER_PASSWORD=$NEXT_PUBLIC_REVIEWER_PASSWORD
ENV CAPACITOR_BUILD=false
ENV NODE_ENV=production

# Build Next.js (produces .next/standalone)
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# HOSTname required for proper listening in container
ENV HOSTNAME="0.0.0.0"

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build
# This includes necessary node_modules and server.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 8080

# Health check (Next.js doesn't have default /health, but / should work)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start Node.js server
CMD ["node", "server.js"]
