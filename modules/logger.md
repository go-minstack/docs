# logger

Structured logging module for MinStack. Provides a `*slog.Logger` (Go standard library) with structured, high-performance output — no logging dependency required in your application code.

## Installation

```sh
go get github.com/go-minstack/logger
```

## Usage

The logger is **included automatically** by `core.New()` — you don't need to register `logger.Module()`. Just inject `*slog.Logger` wherever you need it:

```go
type UserService struct {
    log *slog.Logger
}

func NewUserService(log *slog.Logger) *UserService {
    return &UserService{log: log}
}

func (s *UserService) Create(name string) {
    s.log.Info("user created", "name", name)
}
```

Configure via environment variables:

```sh
MINSTACK_LOG_FORMAT=console MINSTACK_LOG_LEVEL=debug ./myapp
```

## FX lifecycle events

The logger also routes FX's own lifecycle events (Provided, Invoked, Started, etc.) through the same logger, replacing FX's default stdout output.

## Environment variables

| Variable | Values | Default |
|----------|--------|---------|
| `MINSTACK_LOG_LEVEL` | trace, debug, info, warn, error | info |
| `MINSTACK_LOG_FORMAT` | json, console | json |

## Output formats

**JSON** (default) — structured, machine-readable, suitable for production:

```sh
{"level":"info","time":"2024-01-01T00:00:00Z","message":"user created","name":"Alice"}
```

**Console** — human-readable, colored, suitable for local development:

```sh
MINSTACK_LOG_FORMAT=console ./myapp
```

## Notes

- Your app only imports `log/slog` (Go standard library)
- The logging backend is an internal implementation detail — not in your app's `go.mod`
