# Build stage - use slim (Debian-based) for Prisma compatibility
FROM node:20-slim AS builder

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including dev for build)
RUN npm install

# Copy source code
COPY src ./src
COPY packages ./packages

# Cache buster for Prisma generation
ARG CACHEBUST=2026020501
# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Prune dev dependencies for production
RUN npm prune --production

# Production stage
FROM node:20-slim AS runner

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./

# Set ownership to non-root user
RUN chown -R appuser:nodejs /app

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Switch to non-root user
USER appuser

# Health check with longer start period for migration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Run migration then start server (use migrate deploy, NOT db push)
CMD /bin/sh -c "cd /app/packages/database && npx prisma migrate deploy && cd /app && node src/index.js"
