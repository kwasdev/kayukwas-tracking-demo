# ==============================================================================
# Multi-stage Dockerfile for Kayu KWAS Tracking Backend (Go + Fiber + SQLite)
# ==============================================================================

# Stage 1: Build
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies for CGO & SQLite
RUN apk add --no-cache gcc musl-dev

# Download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server/main.go

# Stage 2: Runtime
FROM alpine:3.21

WORKDIR /app

# Install runtime certificates & libraries
RUN apk add --no-cache ca-certificates tzdata sqlite-libs

# Create directory for SQLite storage
RUN mkdir -p /app/data

# Copy binary from builder
COPY --from=builder /app/server /app/server
COPY --from=builder /app/.env.example /app/.env.example

# Set environment defaults
ENV PORT=8080 \
    DB_DRIVER=sqlite \
    DB_NAME=/app/data/kayukwas.db

EXPOSE 8080

CMD ["/app/server"]
