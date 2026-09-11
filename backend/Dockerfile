# Must match the go directive in go.mod: the official images set
# GOTOOLCHAIN=local, so a builder older than go.mod's requirement fails rather
# than fetching the newer toolchain. Until a dependency changed go.sum this was
# hidden by the cached "go mod download" layer.
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server /server
COPY --from=builder /app/internal/database/migrations /migrations

EXPOSE 8080

CMD ["/server"]
