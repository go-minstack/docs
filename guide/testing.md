# Testing

MinStack apps are straightforward to test. This guide covers two approaches:

- **Unit tests** — isolate service logic with mock repositories, no database needed
- **E2E tests** — boot the full app with SQLite `:memory:` and exercise HTTP endpoints

All examples are from the [Todo API tutorial](/tutorials/todo-api/).

---

## Unit testing

### The interface pattern

Services depend on a **repository interface** instead of the concrete type. The constructor still accepts the concrete type (for FX), but the struct field uses the interface:

```go
type todoRepository interface {
    FindAll(opts ...repository.QueryOption) ([]todo_entities.Todo, error)
    FindByID(id uint) (*todo_entities.Todo, error)
    Create(entity *todo_entities.Todo) error
    UpdatesByID(id uint, columns map[string]interface{}) error
    DeleteByID(id uint) error
}

type TodoService struct {
    todos todoRepository  // interface field
}

// Constructor takes concrete type — FX injects the real repository,
// which satisfies the interface automatically.
func NewTodoService(todos *todo_repos.TodoRepository) *TodoService {
    return &TodoService{todos: todos}
}
```

### Writing a mock

Create a mock struct that implements the interface with an in-memory slice:

```go
type mockTodoRepo struct {
    todos  []todo_entities.Todo
    nextID uint
}

func (m *mockTodoRepo) FindAll(opts ...repository.QueryOption) ([]todo_entities.Todo, error) {
    result := make([]todo_entities.Todo, len(m.todos))
    copy(result, m.todos)
    return result, nil
}

func (m *mockTodoRepo) FindByID(id uint) (*todo_entities.Todo, error) {
    for _, t := range m.todos {
        if t.ID == id {
            return &t, nil
        }
    }
    return nil, errors.New("record not found")
}

func (m *mockTodoRepo) Create(entity *todo_entities.Todo) error {
    entity.ID = m.nextID
    m.nextID++
    m.todos = append(m.todos, *entity)
    return nil
}

// ... UpdatesByID, DeleteByID follow the same pattern
```

### Test cases

Tests create the service directly with the mock — no FX, no database:

```go
func TestTodoService_Create(t *testing.T) {
    repo := &mockTodoRepo{nextID: 1}
    svc := &TodoService{todos: repo}

    todo, err := svc.Create(dto.CreateTodoDto{
        Title:       "Buy milk",
        Description: "From the store",
    })
    require.NoError(t, err)
    assert.Equal(t, uint(1), todo.ID)
    assert.Equal(t, "Buy milk", todo.Title)
    assert.False(t, todo.Done)
}
```

Since the test file is in the **same package**, it can access the unexported `todos` field.

---

## E2E testing

E2E tests boot the full MinStack app — real database, real HTTP routing — and exercise the API end to end using `httptest`.

### Setup helper

```go
func setupApp(t *testing.T) *gin.Engine {
    t.Setenv("MINSTACK_DB_URL", ":memory:")
    t.Setenv("MINSTACK_PORT", "0")
    gin.SetMode(gin.TestMode)

    app := core.New(mgin.Module(), sqlite.Module())
    todos.Register(app)

    var engine *gin.Engine
    app.Invoke(func(r *gin.Engine) { engine = r })
    app.Invoke(func(db *gorm.DB) error {
        return db.AutoMigrate(&todo_entities.Todo{})
    })

    ctx := context.Background()
    require.NoError(t, app.Start(ctx))
    t.Cleanup(func() { app.Stop(ctx) })

    return engine
}
```

**Key points:**
- `t.Setenv` — sets env vars scoped to the test, automatically restored after
- `app.Start(ctx)` — builds the FX graph and runs `OnStart` hooks without blocking
- `t.Cleanup` — ensures `app.Stop` is called even if the test fails
- `app.Invoke(func(r *gin.Engine) { ... })` — grabs the gin engine for `httptest`
- `sqlite.Module()` + `:memory:` — fast, isolated, no external process needed

### Making requests

Use `httptest.NewRecorder` and `r.ServeHTTP` to test the full HTTP flow:

```go
func TestTodoAPI(t *testing.T) {
    r := setupApp(t)

    t.Run("Create", func(t *testing.T) {
        body, _ := json.Marshal(map[string]string{
            "title": "Buy milk",
        })
        w := httptest.NewRecorder()
        req := httptest.NewRequest(http.MethodPost, "/api/todos",
            bytes.NewBuffer(body))
        req.Header.Set("Content-Type", "application/json")
        r.ServeHTTP(w, req)

        assert.Equal(t, http.StatusCreated, w.Code)

        var todo map[string]any
        json.Unmarshal(w.Body.Bytes(), &todo)
        assert.Equal(t, "Buy milk", todo["title"])
    })
}
```

---

## Coverage

Go has built-in coverage. Use `-coverpkg=./internal/...` to measure only your application code (excluding `cmd/main.go` which can't be unit-tested):

```sh
go test ./... -coverpkg=./internal/... -coverprofile=coverage.out
```

View per-function breakdown:

```sh
go tool cover -func=coverage.out
```

```
todo.controller.go:21   list            60.0%
todo.controller.go:30   create          77.8%
todo.service.go:59      Update          91.7%
total:                  (statements)    94.7%
```

Generate an HTML report:

```sh
go tool cover -html=coverage.out -o coverage.html
```

This opens a visual file-by-file report where covered lines are green and uncovered lines are red — similar to Istanbul/Jest.

---

## Testing with real databases

When you need PostgreSQL or MySQL-specific behaviour (JSON columns, full-text search, etc.), use Docker in CI and point `MINSTACK_DB_URL` at the real service:

```sh
MINSTACK_DB_URL="host=localhost user=minstack password=minstack dbname=minstack_test sslmode=disable" \
    go test ./...
```

Keep the bulk of your tests on SQLite (fast, zero setup) and reserve real-DB tests for integration tests that need driver-specific features.

---

## Recommended packages

```sh
go get github.com/stretchr/testify
```

| Package | Use |
|---------|-----|
| `testify/require` | Fail fast on fatal assertions (`require.NoError`, `require.NotNil`) |
| `testify/assert` | Non-fatal assertions (`assert.Equal`, `assert.Empty`) |
| `net/http/httptest` | Standard library — recorder + request for E2E tests |

---

## Full example

See the [Todo API tutorial](/tutorials/todo-api/testing) for complete, runnable test files.
