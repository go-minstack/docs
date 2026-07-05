# migration

SQL and Go migrations for MinStack via [goose](https://github.com/pressly/goose). The SQL dialect is auto-detected from the GORM dialector — supports PostgreSQL, MySQL, and SQLite.

## Installation

```sh
go get github.com/go-minstack/go-minstack/migration
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
    postgres.Module(),
    migration.Module(migrations.FS),
)
app.Invoke(migration.Run)
app.Run()
```

`Module` wires the `*Migrator` into the container. Calling `migration.Run` is the explicit opt-in to apply pending migrations on startup — before the HTTP server begins accepting traffic.

## SQL migration files

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

## Go migrations

Use Go migrations when you need dialect-specific logic that cannot be expressed in a single SQL file (for example, SQLite table recreation vs a one-line `ALTER` on Postgres).

Register them with `WithGoMigrations`:

```go
// internal/migrations/go_migrations.go
package migrations

import (
    "context"
    "database/sql"

    "github.com/pressly/goose/v3"
)

func Go() []*goose.Migration {
    return []*goose.Migration{
        goose.NewGoMigration(2,
            &goose.GoFunc{RunDB: upV2},
            &goose.GoFunc{RunDB: downV2},
        ),
    }
}

func upV2(ctx context.Context, db *sql.DB) error {
    // switch on driver / run dialect-specific DDL
    return nil
}

func downV2(ctx context.Context, db *sql.DB) error {
    return nil
}
```

Wire SQL and Go together:

```go
app := core.New(
    sqlite.Module(),
    migration.Module(
        migrations.FS,
        migration.WithGoMigrations(migrations.Go()...),
    ),
)
app.Invoke(migration.Run)
```

### Version numbers

SQL and Go migrations share **one version sequence**. Goose applies them in ascending order by version number.

- `00001_init.sql` → version 1
- `goose.NewGoMigration(2, ...)` → version 2

**Do not** use the same version in both formats (e.g. `00002_foo.sql` and `NewGoMigration(2, ...)` together). Goose rejects duplicate versions at startup.

### RunDB vs RunTx

- `RunTx` — runs inside a SQL transaction (default for most DDL/DML).
- `RunDB` — runs without a transaction. Use for SQLite DDL that cannot run inside a transaction, or when you need `PRAGMA` statements.

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
| `Module(fs, opts...) fx.Option` | Primary — wire migrations via `core.New()` |
| `WithGoMigrations(m ...*goose.Migration) Option` | Register Go migrations alongside embedded SQL |
| `New(db, log, fs, opts...) *Migrator` | Create a Migrator with a custom logger and options |
| `Run(m *Migrator) error` | FX invoke target for manual wiring |
| `(*Migrator).Up() error` | Apply all pending migrations |
