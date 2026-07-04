# Getting Started

## Prerequisites

- Go 1.25 or later

## Installation

Install only the packages your app needs:

```sh
go get github.com/go-minstack/go-minstack/core
go get github.com/go-minstack/go-minstack/gin      # HTTP server
go get github.com/go-minstack/go-minstack/cli      # CLI / scripts
go get github.com/go-minstack/go-minstack/auth     # JWT auth
go get github.com/go-minstack/go-minstack/logger   # structured logging
go get github.com/go-minstack/go-minstack/mysql    # MySQL
go get github.com/go-minstack/go-minstack/postgres # PostgreSQL
go get github.com/go-minstack/go-minstack/sqlite   # SQLite
go get github.com/go-minstack/go-minstack/repository
go get github.com/go-minstack/go-minstack/web
go get github.com/go-minstack/go-minstack/migration
```

## Your first app

### HTTP server

```go
package main

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/go-minstack/core"
    mgin "github.com/go-minstack/go-minstack/gin"
)

func registerRoutes(r *gin.Engine) {
    r.GET("/hello", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "Hello from MinStack!"})
    })
}

func main() {
    app := core.New(mgin.Module())
    app.Invoke(registerRoutes)
    app.Run()
}
```

### CLI / script

`cli.Module()` wraps the fx lifecycle under the hood: it runs `ConsoleApp.Run` in a goroutine on `OnStart`, then calls `fx.Shutdowner` when it finishes — causing `app.Run()` to unblock and exit cleanly. Use it when your task needs the full dependency graph but you still want automatic exit on completion.

```go
package main

import (
    "context"
    "log/slog"

    "github.com/go-minstack/go-minstack/cli"
    "github.com/go-minstack/go-minstack/core"
)

type App struct{ log *slog.Logger }

func NewApp(log *slog.Logger) cli.ConsoleApp { return &App{log: log} }

func (a *App) Run(ctx context.Context) error {
    a.log.Info("Hello from MinStack!")
    return nil
}

func main() {
    app := core.New(cli.Module())
    app.Provide(NewApp)
    app.Run()
}
```

### Explicit lifecycle (Start / Stop)

For simpler one-shot tasks, skip `cli.Module()` and control the lifecycle directly. `Invoke` resolves and calls the function immediately when `Start` is called — no goroutines, no Shutdowner:

```go
package main

import (
    "context"
    "log"
    "log/slog"

    "github.com/go-minstack/go-minstack/core"
)

type Greeter struct{ log *slog.Logger }

func NewGreeter(log *slog.Logger) *Greeter { return &Greeter{log: log} }

func run(g *Greeter) {
    g.log.Info("Hello from MinStack!")
}

func main() {
    app := core.New()
    app.Provide(NewGreeter)
    app.Invoke(run)

    ctx := context.Background()
    if err := app.Start(ctx); err != nil {
        log.Fatal(err)
    }
    defer app.Stop(ctx)
}
```

### Extending the lifecycle

Any provided constructor can accept `fx.Lifecycle` to register `OnStart` / `OnStop` hooks. This is exactly what `cli.Module()` does internally, and it's how database modules open and close connections:

```go
import (
    "log/slog"
    "go.uber.org/fx"
)

func NewGreeter(lc fx.Lifecycle, log *slog.Logger) *Greeter {
    g := &Greeter{log: log}
    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            log.Info("starting…")
            return nil
        },
        OnStop: func(ctx context.Context) error {
            log.Info("stopping…")
            return nil
        },
    })
    return g
}
```

Hooks are called in registration order during start, and in reverse order during stop.

::: tip Run vs Start/Stop
`app.Run()` blocks until an OS signal is received — the right choice for servers and long-running processes.
`app.Start` / `app.Stop` give you explicit control and are preferred for scripts, tests, and one-shot tasks.
:::

## Environment variables

Database modules read connection details from the environment:

| Variable | Used by |
|----------|---------|
| `MINSTACK_DB_URL` | mysql, postgres, sqlite |
| `MINSTACK_HOST` | gin |
| `MINSTACK_HTTP_PORT` | gin (preferred port variable) |
| `MINSTACK_PORT` | gin (fallback port variable, default: `8080`) |
| `MINSTACK_CORS_ORIGIN` | gin (optional) |
| `MINSTACK_JWT_SECRET` | auth (HMAC fallback) |
| `MINSTACK_JWT_PRIVATE_KEY` | auth (RSA sign + validate) |
| `MINSTACK_JWT_PUBLIC_KEY` | auth (RSA validate) |
| `MINSTACK_JWKS_URL` | auth (JWKS validate) |
| `MINSTACK_LOG_LEVEL` | logger |
| `MINSTACK_LOG_FORMAT` | logger |
