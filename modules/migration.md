# migration

SQL migrations for MinStack via [goose](https://github.com/pressly/goose). The SQL dialect is auto-detected from the GORM dialector — supports PostgreSQL, MySQL, and SQLite.

## Installation

```sh
go get github.com/go-minstack/migration
```

## Usage

Create a dedicated `internal/migrations` package that exports the embedded FS:

```go
// internal/migrations/migrations.go
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
```

Pass it to `migration.Module` and opt-in to running:

```go
// cmd/main.go
app := core.New(
    postgres.Module,
    migration.Module(migrations.FS),
)
app.Invoke(migration.Run)
app.Run()
```

`Module` wires the `*Migrator` into the container. Calling `migration.Run` is the explicit opt-in to apply pending migrations on startup — before the HTTP server begins accepting traffic.

## Migration files

Place SQL files in `internal/migrations/` following goose conventions:

```sql
-- 00001_create_users.sql

-- +goose Up
CREATE TABLE users (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- +goose Down
DROP TABLE users;
```

File names must follow the pattern `{version}_{description}.sql`. Versions are applied in ascending order.

## Custom logger

To inject a custom `*slog.Logger`, use `New` directly:

```go
func NewMigrator(db *gorm.DB, log *slog.Logger) *migration.Migrator {
    return migration.New(db, log, migrations.FS)
}

func Register(app *core.App) {
    app.Provide(NewMigrator)
    app.Invoke(migration.Run)
}
```

## API

| Export | Description |
|--------|-------------|
| `Module(fs) fx.Option` | Primary — wire migrations via `core.New()` |
| `New(db, log, fs) *Migrator` | Create a Migrator with a custom logger |
| `Run(m *Migrator) error` | FX invoke target for manual wiring |
| `(*Migrator).Up() error` | Apply all pending migrations |
