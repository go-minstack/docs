# mysql

MySQL module for MinStack. Provides a GORM `*gorm.DB` and a `binary(16)` UUID type optimized for MySQL.

## Installation

```sh
go get github.com/go-minstack/mysql
```

## Usage

```go
func main() {
    app := core.New(cli.Module(), mysql.Module())
    app.Provide(NewApp)
    app.Run()
}
```

```sh
DB_URL="user:pass@tcp(localhost:3306)/dbname?parseTime=True" ./myapp
```

## UUID type

MySQL doesn't have a native UUID column type. MinStack provides `mysql.UUID` which stores UUIDs as `binary(16)` — efficient and index-friendly.

```go
type User struct {
    ID   mysql.UUID `gorm:"primaryKey"`
    Name string
}

user := User{ID: mysql.NewUUID(), Name: "MinStack"}
```

## API

### `mysql.Module() fx.Option`
Registers `*gorm.DB` into the DI container. Reads `DB_URL` from the environment.

### UUID

| Function | Description |
|----------|-------------|
| `mysql.NewUUID()` | Generate a new random UUID |
| `mysql.ParseUUID(s)` | Parse a UUID string |
| `mysql.MustParseUUID(s)` | Parse or panic |
| `(UUID).String()` | Format as standard UUID string |
| `(UUID).IsZero()` | Check if zero value |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DB_URL` | MySQL DSN, e.g. `user:pass@tcp(host:3306)/db?parseTime=True` |
