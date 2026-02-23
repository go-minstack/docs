# Introduction

MinStack is a collection of small, independent Go modules for building backend services. Each module does one thing and composes cleanly with the others.

## Philosophy

- **Minimal** — no unnecessary abstractions, no hidden config
- **Composable** — combine only the modules you need
- **Explicit** — every dependency is declared, every behavior is visible

## Dependency Injection with Uber FX

MinStack is built on top of [Uber FX](https://github.com/uber-go/fx) — a production-grade dependency injection framework developed and used at Uber. Every MinStack module exposes a single `Module()` function that registers its providers and hooks into the FX lifecycle.

```go
app := core.New(
    gin.Module(),    // provides *gin.Engine
    postgres.Module(), // provides *gorm.DB
)
app.Run()
```

When you call `app.Run()`, FX:
1. Resolves all declared dependencies
2. Calls `OnStart` hooks in order (e.g. opens DB connection, starts HTTP server)
3. Blocks until a shutdown signal is received
4. Calls `OnStop` hooks in reverse order (graceful shutdown)

**No global state. No `init()` surprises.** If a dependency is missing or a constructor fails, the app refuses to start with a clear error — not a runtime panic.

### Providing your own dependencies

```go
type UserService struct{ db *gorm.DB }

func NewUserService(db *gorm.DB) *UserService {
    return &UserService{db: db}
}

app.Provide(NewUserService) // FX injects *gorm.DB automatically
```

### Running startup logic

```go
func runMigrations(db *gorm.DB) error {
    return db.AutoMigrate(&User{})
}

app.Invoke(runMigrations) // called at startup, dependencies resolved automatically
```

## Modules

| Module | Purpose |
|--------|---------|
| [core](/modules/core) | Application bootstrap — required by all |
| [gin](/modules/gin) | HTTP server using Gin |
| [cli](/modules/cli) | One-shot CLI process that exits when done |
| [mysql](/modules/mysql) | MySQL database via GORM |
| [postgres](/modules/postgres) | PostgreSQL database via GORM |
| [sqlite](/modules/sqlite) | SQLite database via GORM (no CGO) |
