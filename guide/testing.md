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

## Go testing patterns

These are standard Go idioms that make tests clearer and more maintainable.

### Table-driven tests

Instead of writing separate functions for each input, define a **slice of test cases** and loop over them. This is the most common Go test pattern:

```go
func TestTodoService_Get(t *testing.T) {
    repo := newMockTodoRepo()
    svc := &TodoService{todos: repo}
    repo.Create(&todo_entities.Todo{Title: "Buy milk"})

    tests := []struct {
        name    string
        id      uint
        wantErr bool
    }{
        {"found", 1, false},
        {"not found", 999, true},
        {"zero id", 0, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            todo, err := svc.Get(tt.id)
            if tt.wantErr {
                assert.Error(t, err)
                return
            }
            require.NoError(t, err)
            assert.Equal(t, "Buy milk", todo.Title)
        })
    }
}
```

**Why?** Adding a new case is just one line in the table. The test name appears in output (`TestTodoService_Get/not_found`), so failures are easy to locate.

### require vs assert

Both come from `testify`, but they behave differently on failure:

| | On failure | Use when |
|---|---|---|
| `assert` | Logs the failure, **continues** the test | Checking multiple fields on the same response |
| `require` | Logs the failure, **stops** the test immediately | A precondition that makes subsequent checks pointless |

```go
// require — if this fails, the rest makes no sense
require.NoError(t, err)
require.NotNil(t, todo)

// assert — check multiple fields, see all failures at once
assert.Equal(t, "Buy milk", todo.Title)
assert.Equal(t, "From the store", todo.Description)
assert.False(t, todo.Done)
```

**Rule of thumb:** use `require` for errors and nil checks, `assert` for everything else.

### t.Helper()

When you extract a helper function, call `t.Helper()` at the top. This makes Go report the **caller's line number** on failure instead of the helper's:

```go
func createTodo(t *testing.T, r *gin.Engine, title string) uint {
    t.Helper() // ← failure points to the caller, not this function

    w := httptest.NewRecorder()
    body := jsonBody(map[string]string{"title": title})
    req := httptest.NewRequest(http.MethodPost, "/api/todos", body)
    req.Header.Set("Content-Type", "application/json")
    r.ServeHTTP(w, req)

    require.Equal(t, http.StatusCreated, w.Code)

    var todo map[string]any
    parseJSON(t, w, &todo)
    return uint(todo["id"].(float64))
}
```

Without `t.Helper()`, a failure would point to the `require.Equal` line inside `createTodo`. With it, the failure points to the test that called `createTodo` — much easier to debug.

### Covering error branches

Real services have error paths. To cover them, create a mock that **always fails**:

```go
type failingMockRepo struct{}

func (m *failingMockRepo) FindAll(...) ([]Todo, error) {
    return nil, errors.New("db error")
}
func (m *failingMockRepo) Create(entity *Todo) error {
    return errors.New("db error")
}
// ... same for FindByID, UpdatesByID, DeleteByID
```

Then test all error branches in one go:

```go
func TestTodoService_DBErrors(t *testing.T) {
    svc := &TodoService{todos: &failingMockRepo{}}

    _, err := svc.List()
    assert.Error(t, err)

    _, err = svc.Create(dto.CreateTodoDto{Title: "Buy milk"})
    assert.Error(t, err)

    _, err = svc.Get(1)
    assert.Error(t, err)
}
```

For methods with **two failure points** (e.g. `Update` calls `FindByID` then `UpdatesByID`), embed the working mock and override only one method:

```go
type updateFailMockRepo struct {
    mockTodoRepo // inherits FindByID (success)
}

func (m *updateFailMockRepo) UpdatesByID(id uint, columns map[string]interface{}) error {
    return errors.New("db error") // only this fails
}
```

This technique is what pushed our Todo API coverage from 77% to 94%.

### Parallel tests

Independent tests can run concurrently with `t.Parallel()`:

```go
func TestTodoService_Get(t *testing.T) {
    t.Parallel() // ← this test runs in parallel with other parallel tests

    repo := newMockTodoRepo()
    svc := &TodoService{todos: repo}
    repo.Create(&todo_entities.Todo{Title: "Buy milk"})

    t.Run("found", func(t *testing.T) {
        t.Parallel()
        todo, err := svc.Get(1)
        require.NoError(t, err)
        assert.Equal(t, "Buy milk", todo.Title)
    })
}
```

**Caution:** only use `t.Parallel()` when subtests don't share mutable state. Our E2E tests (`TestTodoAPI`) run sequentially because each subtest depends on the previous one (Create → Get → Update → Delete).

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

## Tips

| Tip | Why |
|-----|-----|
| Keep unit tests fast — no network, no disk, no database | Fast feedback loop; run on every save |
| One assertion per concept, not per line | `assert.Equal(t, "Buy milk", todo.Title)` tests one thing even if it's one line |
| Test behavior, not implementation | Don't assert that `FindByID` was called — assert that `Get(1)` returns the right todo |
| Use `t.Run` for subtests | Groups related cases, shows which exact case failed |
| Use `t.Cleanup` instead of `defer` | Runs even if `t.Fatal` is called, and runs in LIFO order |
| Name tests `TestType_Method` | `TestTodoService_Create` — consistent, easy to filter with `-run` |
| Filter tests with `-run` | `go test -run TestTodoService_Create` runs only that test |

---

## Full example

See the [Todo API tutorial](/tutorials/todo-api/testing) for complete, runnable test files.
