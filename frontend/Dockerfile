FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

# Copy package files and pnpm config (shamefully-hoist required)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy full source
COPY . .

# Run postinstall steps manually (prisma generate + icon build)
RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN npx tsx src/assets/iconify-icons/bundle-icons-css.ts

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
