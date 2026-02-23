# repository

Generic, type-safe GORM repository for MinStack. Eliminates data access boilerplate while keeping queries explicit and composable.

## Installation

```sh
go get github.com/go-minstack/repository
```

## Usage

Embed `*repository.Repository[T, ID]` in your domain entity file and wrap it with a typed struct:

```go
type UserRepository struct {
    *repository.Repository[User, uuid.UUID]
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{repository.New[User, uuid.UUID](db)}
}
```

Register with FX so `*gorm.DB` is injected automatically:

```go
app.Provide(user_entities.NewUserRepository)
```

## Base models

You have two options depending on whether you want `uint` or UUID primary keys.

### `gorm.Model` — uint primary key (works with all drivers)

```go
type User struct {
    gorm.Model  // ID uint, CreatedAt, UpdatedAt, DeletedAt
    Name  string
    Email string
}

type UserRepository struct {
    *repository.Repository[User, uint]
}
```

### `UuidModel` — UUID primary key (driver-specific)

`UuidModel` lives in the database module. Pick the one that matches your driver:

| Driver | Embed | ID type |
|--------|-------|---------|
| PostgreSQL | `postgres.UuidModel` | `uuid.UUID` |
| MySQL | `mysql.UuidModel` | `mysql.UUID` (`binary(16)`) |

```go
// PostgreSQL
type User struct {
    postgres.UuidModel
    Name  string
}

type UserRepository struct {
    *repository.Repository[User, uuid.UUID]
}
```

UUID variants auto-generate the ID in Go via `BeforeCreate` — no database function needed.

## Querying

```go
// All active users, ordered by name, page 1
users, err := repo.FindAll(
    repository.Where("active = ?", true),
    repository.Order("name"),
    repository.Paginate(repository.NewPagination(1, 20)),
)

// Single record
user, err := repo.FindOne(repository.Where("email = ?", email))

// By primary key
user, err := repo.FindByID(id)

// Count
total, err := repo.Count(repository.Where("active = ?", true))
```

## Writing

```go
// Create
err := repo.Save(&user)

// Full update
err := repo.Update(&user)

// Partial update
err := repo.UpdatesByID(id, map[string]interface{}{"name": "New Name"})

// Delete
err := repo.DeleteByID(id)
```

## Transactions

```go
err := repo.WithTransaction(func(tx *repository.Repository[User, uuid.UUID]) error {
    if err := tx.Save(&user); err != nil {
        return err // auto-rollback
    }
    if err := tx.Save(&profile); err != nil {
        return err // auto-rollback
    }
    return nil // auto-commit
})
```

## Custom domain queries

Use `DB()` to access `*gorm.DB` directly for joins, aggregations, or any query beyond the standard API:

```go
func (r *UserRepository) FindByEmailDomain(domain string) ([]User, error) {
    var users []User
    err := r.DB().Where("email LIKE ?", "%@"+domain).Find(&users).Error
    return users, err
}
```

## API reference

### `Repository[T, ID]`

| Method | Description |
|--------|-------------|
| `FindByID(id)` | Single record by primary key |
| `FindAll(opts...)` | All records matching options |
| `FindOne(opts...)` | First record matching options |
| `Count(opts...)` | Count matching records |
| `Save(entity)` | Create a new record |
| `Update(entity)` | Full update (all fields) |
| `Updates(entity, columns)` | Partial update via map |
| `UpdatesByID(id, columns)` | Partial update by ID |
| `UpdateAll(values, opts...)` | Bulk update — requires at least one option |
| `Delete(entity)` | Soft delete a record |
| `DeleteByID(id)` | Soft delete by primary key |
| `DeleteAll(opts...)` | Bulk delete — requires at least one option |
| `WithTransaction(fn)` | Run fn inside a transaction |
| `DB()` | Raw `*gorm.DB` escape hatch |

### QueryOptions

| Function | Description |
|----------|-------------|
| `Where(query, args...)` | Add a WHERE clause |
| `Order(column, desc...)` | Add ORDER BY (pass `true` for DESC) |
| `Preload(query, args...)` | Eager load associations |
| `Limit(n)` | Cap the number of results |
| `Scope(fn)` | Apply a raw GORM scope function |
| `Paginate(p)` | Apply a `*Pagination` |

### `Pagination`

```go
p := repository.NewPagination(page, limit)
// defaults: page=1, limit=10, max limit=100
```

## Example

See [examples/hello](https://github.com/go-minstack/repository/tree/main/examples/hello) — demonstrates Save, FindAll, FindOne, UpdatesByID, Count, Paginate, and DeleteByID with SQLite in-memory.

## Constraints

- Requires a `*gorm.DB` — pair with `mysql`, `postgres`, or `sqlite` modules
- No `Module()` — it's a utility package, not an infrastructure provider
- `UpdateAll` and `DeleteAll` require at least one `QueryOption` as a safety guard against accidental full-table operations
