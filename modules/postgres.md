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

## API

### `postgres.Module() fx.Option`
Registers `*gorm.DB` into the DI container. Reads `DB_URL` from the environment.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DB_URL` | PostgreSQL DSN, e.g. `host=localhost user=u password=p dbname=db sslmode=disable` |
