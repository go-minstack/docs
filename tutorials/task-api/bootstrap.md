# 5. Bootstrap

Wire all domains together in `cmd/main.go` and run the app.

## main.go

```go
package main

import (
    "github.com/go-minstack/auth"
    "github.com/go-minstack/core"
    mgin "github.com/go-minstack/gin"
    "github.com/go-minstack/sqlite"
    "task-api/internal/authn"
    "task-api/internal/tasks"
    task_entities "task-api/internal/tasks/entities"
    "task-api/internal/users"
    user_entities "task-api/internal/users/entities"
    "gorm.io/gorm"
)

func migrate(db *gorm.DB) error {
    return db.AutoMigrate(
        &user_entities.User{},
        &task_entities.Task{},
    )
}

func main() {
    app := core.New(mgin.Module(), sqlite.Module(), auth.Module())

    users.Register(app)
    authn.Register(app)
    tasks.Register(app)

    app.Invoke(migrate)
    app.Run()
}
```

Each `Register` call provides all constructors and invokes route registration for its domain. FX resolves the dependency graph automatically.

Adding a new domain is always two lines:

```go
newdomain.Register(app)
// + one line in migrate()
```

## Run

```sh
go run ./cmd
```

You should see all routes printed and the server listening on `:8080`.

## Test

```sh
# Register
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}' | jq -r .token)

# Profile
curl http://localhost:8080/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# Create task
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Buy groceries","description":"Milk, eggs, bread"}'

# List tasks
curl http://localhost:8080/api/tasks \
  -H "Authorization: Bearer $TOKEN"

# Mark done
curl -X PATCH http://localhost:8080/api/tasks/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"done":true}'

# Delete
curl -X DELETE http://localhost:8080/api/tasks/1 \
  -H "Authorization: Bearer $TOKEN"
```
