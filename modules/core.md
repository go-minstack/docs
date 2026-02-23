# core

The minimal foundation for MinStack. Every other module depends on this — nothing else does.

## Installation

```sh
go get github.com/go-minstack/core
```

## Usage

```go
app := core.New()
app.Provide(NewGreeter)
app.Invoke(run)
app.Run()
```

Pass other MinStack modules to `New()` as needed:

```go
app := core.New(gin.Module(), postgres.Module())
```

## API

### `core.New(modules ...fx.Option) *App`
Creates the application. Includes `core.Module()` automatically.

### `app.Provide(constructors ...interface{})`
Registers your constructors into the DI container.

### `app.Invoke(funcs ...interface{})`
Registers startup functions. Dependencies are resolved automatically.

### `app.Run()`
Builds the app and blocks until a shutdown signal is received.

### `app.Start(ctx) / app.Stop(ctx)`
Non-blocking start and stop — useful for tests.

## Constraints

- No HTTP server, no database, no infrastructure
- Interfaces live here; implementations belong in their own module
