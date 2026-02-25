# 3. Bootstrap

Wire everything together in `cmd/main.go` and start the app.

## main.go

```go
package main

import (
	"github.com/go-minstack/core"
	mgin "github.com/go-minstack/gin"
	"github.com/go-minstack/sqlite"
	"todo-api/internal/todos"
	todo_entities "todo-api/internal/todos/entities"
	"gorm.io/gorm"
)

func migrate(db *gorm.DB) error {
	return db.AutoMigrate(&todo_entities.Todo{})
}

func main() {
	app := core.New(mgin.Module(), sqlite.Module())

	todos.Register(app)

	app.Invoke(migrate)
	app.Run()
}
```

Three modules:
- `mgin.Module()` — Gin HTTP server
- `sqlite.Module()` — SQLite database from `MINSTACK_DB_URL`
- `logger.Module()` — auto-included by `core.New()`

`todos.Register(app)` provides the repository, service, and controller, then invokes the route registration.

## Run it

```sh
go run ./cmd
```

## Try it

```sh
# Create
curl -s -X POST http://localhost:8080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","description":"From the store"}'

# List
curl -s http://localhost:8080/api/todos

# Get
curl -s http://localhost:8080/api/todos/1

# Update
curl -s -X PATCH http://localhost:8080/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'

# Delete
curl -s -X DELETE http://localhost:8080/api/todos/1
```

---

Next: [Testing](./testing)
