# gin

HTTP server module for MinStack, built on [Gin](https://github.com/gin-gonic/gin).

## Installation

```sh
go get github.com/go-minstack/gin
```

## Usage

```go
import (
    "github.com/go-minstack/core"
    mgin "github.com/go-minstack/gin"
)

func registerRoutes(r *gin.Engine) {
    r.GET("/hello", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "Hello!"})
    })
}

func main() {
    app := core.New(mgin.Module())
    app.Invoke(registerRoutes)
    app.Run()
}
```

::: tip Import alias
The package name is `gin`, which conflicts with `github.com/gin-gonic/gin`. Use `mgin` as an alias.
:::

## API

### `gin.Module() fx.Option`
Registers a `*gin.Engine` into the DI container with sensible defaults (recovery, logger).

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Address to bind |
| `PORT` | `8080` | Port to listen on |
| `CORS_ORIGIN` | _(unset)_ | Allowed origin(s), comma-separated. Use `*` to allow all. |
