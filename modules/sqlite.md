# sqlite

SQLite module for MinStack. Provides a GORM `*gorm.DB` backed by SQLite — no CGO required.

## Installation

```sh
go get github.com/go-minstack/sqlite
```

## Usage

```go
func main() {
    app := core.New(cli.Module(), sqlite.Module())
    app.Provide(NewApp)
    app.Run()
}
```

```sh
MINSTACK_DB_URL=./data.db ./myapp
```

### In-memory database

Useful for tests and scripts:

```sh
MINSTACK_DB_URL=:memory: ./myapp
```

## Entity models

### `gorm.Model` — default

The standard GORM base model with `uint` primary key.

```go
type User struct {
    gorm.Model  // ID uint, CreatedAt, UpdatedAt, DeletedAt
    Name  string
    Email string
}
```

### `sqlite.UuidModel` — optional

An alternative base model with a UUID primary key stored as `text` (SQLite has no native UUID type). The ID is auto-generated in Go via `BeforeCreate`.

```go
type User struct {
    sqlite.UuidModel  // ID uuid.UUID, CreatedAt, UpdatedAt, DeletedAt
    Name  string
    Email string
}
```

## API

### `sqlite.Module() fx.Option`
Registers `*gorm.DB` into the DI container. Reads `MINSTACK_DB_URL` from the environment.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MINSTACK_DB_URL` | File path (e.g. `./data.db`) or `:memory:` |

## Constraints

- Pure Go — no CGO, no system SQLite library needed
- Not recommended for high-concurrency production workloads
