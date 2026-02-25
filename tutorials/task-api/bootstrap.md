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
    auth_domain "task-api/internal/auth"
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

    // Register shared dependencies (repositories + services)
    users.Register(app)
    auth_domain.Register(app)
    tasks.Register(app)

    // Register HTTP layer (controllers + routes)
    users.RegisterService(app)
    auth_domain.RegisterService(app)
    tasks.RegisterService(app)

    app.Invoke(migrate)
    app.Run()
}
```

Call `Register` for every domain first, then `RegisterService`. This ensures FX can resolve all dependencies (repositories, services) before any controller or route is registered.

Adding a new domain is always the same four lines:

```go
newdomain.Register(app)
newdomain.RegisterService(app)
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
