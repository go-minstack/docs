# gin

HTTP server module for MinStack, built on [Gin](https://github.com/gin-gonic/gin).

## Installation

```sh
go get github.com/go-minstack/go-minstack/gin
```

## Usage

```go
import (
    "github.com/go-minstack/go-minstack/core"
    mgin "github.com/go-minstack/go-minstack/gin"
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

## Serving static files (and SPAs)

Serve files from an `fs.FS` — typically an `embed.FS` of a Vite `dist/` build. Register API and WebSocket routes first, then invoke `ServeStatic` so the NoRoute handler only covers unmatched GET/HEAD paths.

Existing files (JS/CSS under `/assets/*`, favicon, etc.) are served as static assets. Pass `WithSPAIndex` to enable nginx-style `try_files $uri /index.html` for client-side routing. Without it, missing paths return 404.

```go
// internal/portal/fs.go
package portal

import "embed"

//go:embed all:dist
var FS embed.FS
```

```go
// cmd/server/main.go
app := core.New(mgin.Module(), /* ... */)
app.Invoke(api.RegisterRoutes) // API + WS first
app.Invoke(mgin.ServeStatic(portal.FS,
    mgin.WithSubDir("dist"),
    mgin.WithSPAIndex(),
))
app.Run()
```

`ServeStatic` does not embed files itself — the app’s `//go:embed` (or another `fs.FS`) supplies the assets. Unmatched paths under `/api` are left as 404 by default so missing API routes are not swallowed.

## API

### `gin.Module() fx.Option`
Registers a `*gin.Engine` into the DI container. All Gin debug output and HTTP request logs are routed through the internal `*slog.Logger`.

### `gin.ServeStatic(fsys fs.FS, opts ...StaticOption) any`
Returns an fx Invoke target that registers NoRoute-based static serving. FX injects `*gin.Engine`. Call after domain route registration.

| Option | Default | Description |
|--------|---------|-------------|
| `WithSubDir(dir)` | _(none)_ | Serve from a subdirectory of `fsys` (e.g. `"dist"`) |
| `WithExcludePrefixes(...)` | `"/api"` | Prefixes ServeStatic must not handle (404). Replaces the default; empty disables exclusion |
| `WithSPAIndex([name])` | _(off)_ | Enable SPA fallback. `WithSPAIndex()` uses `"index.html"`; pass a name for a custom entry |

Behavior: GET/HEAD only; existing files get Vite-friendly cache headers (`/assets/*` long-cache, `index.html` no-cache); without `WithSPAIndex`, misses are 404.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MINSTACK_HTTP_PORT` | — | Port to listen on |
| `MINSTACK_PORT` | `8080` | Port to listen on (fallback) |
| `MINSTACK_HOST` | `0.0.0.0` | Address to bind |
| `MINSTACK_CORS_ORIGIN` | _(unset)_ | Allowed origin(s), comma-separated. Use `*` to allow all. |

::: tip Port resolution
`MINSTACK_HTTP_PORT` takes precedence over `MINSTACK_PORT`. Use `MINSTACK_PORT` only as a fallback — prefer `MINSTACK_HTTP_PORT` for new projects.
:::
