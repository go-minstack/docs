# postgres

PostgreSQL module for MinStack. Provides a GORM `*gorm.DB` connected to a PostgreSQL database.

## Installation

```sh
go get github.com/go-minstack/postgres
```

## Usage

```go
func main() {
    app := core.New(cli.Module(), postgres.Module())
    app.Provide(NewApp)
    app.Run()
}
```

```sh
DB_URL="host=localhost user=myuser password=mypass dbname=mydb port=5432 sslmode=disable" ./myapp
```

## Entity models

### `gorm.Model` — default

The standard GORM base model. Uses `uint` as the primary key and works with all drivers.

```go
type User struct {
    gorm.Model          // ID uint, CreatedAt, UpdatedAt, DeletedAt
    Name  string
    Email string
}
```

### `postgres.UuidModel` — optional

An alternative base model with a native PostgreSQL `uuid` primary key, auto-generated in Go via `BeforeCreate`.

```go
type User struct {
    postgres.UuidModel  // ID uuid.UUID, CreatedAt, UpdatedAt, DeletedAt
    Name  string
    Email string
}
```

## API

### `postgres.Module() fx.Option`
Registers `*gorm.DB` into the DI container. Reads `DB_URL` from the environment.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DB_URL` | PostgreSQL DSN, e.g. `host=localhost user=u password=p dbname=db sslmode=disable` |
