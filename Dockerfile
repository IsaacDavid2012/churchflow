# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Backend Runtime
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm --prefix backend install --omit=dev

# Copy shared library & backend source
COPY shared ./shared
COPY backend ./backend

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose ServeSync Web & API Port
EXPOSE 3000

# Start Server (with auto-migration on boot)
CMD ["sh", "-c", "node backend/src/db/migrate.js && node backend/src/server.js"]
