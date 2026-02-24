# cli

Run a Go program as a one-shot CLI process. The app exits automatically when your logic finishes.

## Installation

```sh
go get github.com/go-minstack/cli
```

## Usage

Implement `cli.ConsoleApp` and register it with `app.Provide`:

```go
type App struct{ log *slog.Logger }

func NewApp(log *slog.Logger) cli.ConsoleApp { return &App{log: log} }

func (a *App) Run(ctx context.Context) error {
    a.log.Info("Hello!")
    return nil
}

func main() {
    app := core.New(cli.Module(), logger.Module())
    app.Provide(NewApp)
    app.Run()
}
```

## With a database

```go
type App struct{ db *gorm.DB }

func NewApp(db *gorm.DB) cli.ConsoleApp { return &App{db: db} }

func (a *App) Run(ctx context.Context) error {
    // query, migrate, seed...
    return nil
}

func migrate(db *gorm.DB) error {
    return db.AutoMigrate(&User{})
}

func main() {
    app := core.New(cli.Module(), sqlite.Module())
    app.Provide(NewApp)
    app.Invoke(migrate)
    app.Run()
}
```

## API

### `cli.ConsoleApp`
```go
type ConsoleApp interface {
    Run(ctx context.Context) error
}
```

### `cli.Module() fx.Option`
Wires the console runner into the fx lifecycle. The process exits when `Run` returns.

## Constraints

- One `ConsoleApp` per process
- If `Run` returns a non-nil error, the process exits with code 1
