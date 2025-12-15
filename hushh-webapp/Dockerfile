# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
# copy only deps we need for build
COPY --from=deps /app/node_modules ./node_modules
# copy source (ensure .dockerignore excludes node_modules and .next)
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# use build-time args (only if truly needed for build)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_BACKEND_URL
# do NOT include DATABASE_URL here if it is a runtime secret
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Install libc6-compat in runner in case native modules need it at runtime
RUN apk add --no-cache libc6-compat

# create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy only what the standalone output needs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The standalone output includes a package.json and a node_modules folder inside it.
# You should NOT copy /app/node_modules from builder to runner — duplicate and large.
# Set ownership and drop root
RUN chown -R nextjs:nodejs /app
USER nextjs

# Cloud Run sets PORT at runtime; default to 8080 for conv.
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]