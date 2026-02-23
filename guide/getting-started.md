# Getting Started

## Prerequisites

- Go 1.22 or later

## Installation

Install the modules you need:

```sh
go get github.com/go-minstack/core
go get github.com/go-minstack/gin      # HTTP server
go get github.com/go-minstack/cli      # CLI / scripts
go get github.com/go-minstack/mysql    # MySQL
go get github.com/go-minstack/postgres # PostgreSQL
go get github.com/go-minstack/sqlite   # SQLite
```

## Your first app

### HTTP server

```go
package main

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/core"
    mgin "github.com/go-minstack/gin"
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

```go
package main

import (
    "context"
    "fmt"

    "github.com/go-minstack/cli"
    "github.com/go-minstack/core"
)

type App struct{}

func NewApp() cli.ConsoleApp { return &App{} }

func (a *App) Run(ctx context.Context) error {
    fmt.Println("Hello from MinStack!")
    return nil
}

func main() {
    app := core.New(cli.Module())
    app.Provide(NewApp)
    app.Run()
}
```

## Environment variables

Database modules read connection details from the environment:

| Variable | Used by |
|----------|---------|
| `DB_URL` | mysql, postgres, sqlite |
| `HOST` | gin (default: `0.0.0.0`) |
| `PORT` | gin (default: `8080`) |
| `CORS_ORIGIN` | gin (optional) |
