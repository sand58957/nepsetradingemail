FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o server ./cmd/server \
 && CGO_ENABLED=0 go build -o blogcovers ./cmd/blogcovers

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server /server
# Maintenance command: redraw post covers after a design change.
COPY --from=builder /app/blogcovers /blogcovers
COPY --from=builder /app/internal/database/migrations /migrations

EXPOSE 8080

CMD ["/server"]
