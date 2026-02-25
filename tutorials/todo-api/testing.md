# 4. Testing

This is where it gets interesting. We'll write **unit tests** for the service (with a mock repository) and **E2E tests** that boot the full app and hit real HTTP endpoints.

```sh
go get github.com/stretchr/testify
```

## Unit tests

Unit tests isolate the service from the database. The key is the **`todoRepository` interface** we defined in `todo.service.go` — in tests we provide a mock implementation instead of the real repository.

```
internal/todos/todo.service_test.go
```

### Mock repository

Since test files in the same directory share the package, we can access unexported fields and create the service directly — no FX needed.

```go
package todos

import (
	"errors"
	"testing"

	"github.com/go-minstack/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"todo-api/internal/todos/dto"
	todo_entities "todo-api/internal/todos/entities"
)

type mockTodoRepo struct {
	todos  []todo_entities.Todo
	nextID uint
}

func newMockTodoRepo() *mockTodoRepo {
	return &mockTodoRepo{nextID: 1}
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

func (m *mockTodoRepo) UpdatesByID(id uint, columns map[string]interface{}) error {
	for i, t := range m.todos {
		if t.ID == id {
			if v, ok := columns["title"]; ok {
				m.todos[i].Title = v.(string)
			}
			if v, ok := columns["description"]; ok {
				m.todos[i].Description = v.(string)
			}
			if v, ok := columns["done"]; ok {
				m.todos[i].Done = v.(bool)
			}
			return nil
		}
	}
	return errors.New("record not found")
}

func (m *mockTodoRepo) DeleteByID(id uint) error {
	for i, t := range m.todos {
		if t.ID == id {
			m.todos = append(m.todos[:i], m.todos[i+1:]...)
			return nil
		}
	}
	return errors.New("record not found")
}
```

### Test cases

```go
func TestTodoService_List(t *testing.T) {
	repo := newMockTodoRepo()
	svc := &TodoService{todos: repo}

	// empty list
	todos, err := svc.List()
	require.NoError(t, err)
	assert.Empty(t, todos)

	// add some todos
	repo.Create(&todo_entities.Todo{Title: "Buy milk"})
	repo.Create(&todo_entities.Todo{Title: "Walk dog"})

	todos, err = svc.List()
	require.NoError(t, err)
	assert.Len(t, todos, 2)
	assert.Equal(t, "Buy milk", todos[0].Title)
	assert.Equal(t, "Walk dog", todos[1].Title)
}

func TestTodoService_Create(t *testing.T) {
	repo := newMockTodoRepo()
	svc := &TodoService{todos: repo}

	todo, err := svc.Create(dto.CreateTodoDto{
		Title:       "Buy milk",
		Description: "From the store",
	})
	require.NoError(t, err)
	assert.Equal(t, uint(1), todo.ID)
	assert.Equal(t, "Buy milk", todo.Title)
	assert.Equal(t, "From the store", todo.Description)
	assert.False(t, todo.Done)
}

func TestTodoService_Get(t *testing.T) {
	repo := newMockTodoRepo()
	svc := &TodoService{todos: repo}

	repo.Create(&todo_entities.Todo{Title: "Buy milk"})

	t.Run("found", func(t *testing.T) {
		todo, err := svc.Get(1)
		require.NoError(t, err)
		assert.Equal(t, "Buy milk", todo.Title)
	})

	t.Run("not found", func(t *testing.T) {
		_, err := svc.Get(999)
		assert.Error(t, err)
	})
}

func TestTodoService_Update(t *testing.T) {
	repo := newMockTodoRepo()
	svc := &TodoService{todos: repo}

	repo.Create(&todo_entities.Todo{Title: "Buy milk"})

	t.Run("update title", func(t *testing.T) {
		todo, err := svc.Update(1, dto.UpdateTodoDto{Title: "Buy bread"})
		require.NoError(t, err)
		assert.Equal(t, "Buy bread", todo.Title)
	})

	t.Run("mark done", func(t *testing.T) {
		done := true
		todo, err := svc.Update(1, dto.UpdateTodoDto{Done: &done})
		require.NoError(t, err)
		assert.True(t, todo.Done)
	})

	t.Run("not found", func(t *testing.T) {
		_, err := svc.Update(999, dto.UpdateTodoDto{Title: "Nope"})
		assert.Error(t, err)
	})
}

func TestTodoService_Delete(t *testing.T) {
	repo := newMockTodoRepo()
	svc := &TodoService{todos: repo}

	repo.Create(&todo_entities.Todo{Title: "Buy milk"})

	t.Run("delete existing", func(t *testing.T) {
		err := svc.Delete(1)
		require.NoError(t, err)
		assert.Empty(t, repo.todos)
	})

	t.Run("delete non-existent", func(t *testing.T) {
		err := svc.Delete(999)
		assert.Error(t, err)
	})
}
```

Run them:

```sh
go test ./internal/todos/ -v
```

## E2E tests

E2E tests boot the full MinStack app — real database, real HTTP routing — and exercise the API end to end using `httptest`.

```
e2e/e2e_test.go
```

### Setup helper

```go
package e2e_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/go-minstack/core"
	mgin "github.com/go-minstack/gin"
	"github.com/go-minstack/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"todo-api/internal/todos"
	todo_entities "todo-api/internal/todos/entities"
	"gorm.io/gorm"
)

func setupApp(t *testing.T) *gin.Engine {
	t.Helper()

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

func jsonBody(data any) *bytes.Buffer {
	b, _ := json.Marshal(data)
	return bytes.NewBuffer(b)
}

func parseJSON(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), v))
}
```

Key points:
- `t.Setenv("MINSTACK_DB_URL", ":memory:")` — SQLite in-memory, isolated per test
- `app.Start(ctx)` + `t.Cleanup(app.Stop)` — non-blocking lifecycle
- `app.Invoke(func(r *gin.Engine) { engine = r })` — grab the gin engine for `httptest`

### Test flow

```go
func TestTodoAPI(t *testing.T) {
	r := setupApp(t)

	var todoID uint

	t.Run("List empty", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/todos", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var todos []map[string]any
		parseJSON(t, w, &todos)
		assert.Empty(t, todos)
	})

	t.Run("Create", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := jsonBody(map[string]string{
			"title":       "Buy milk",
			"description": "From the store",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/todos", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var todo map[string]any
		parseJSON(t, w, &todo)
		assert.Equal(t, "Buy milk", todo["title"])
		assert.Equal(t, "From the store", todo["description"])
		assert.False(t, todo["done"].(bool))
		todoID = uint(todo["id"].(float64))
	})

	t.Run("Get", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet,
			fmt.Sprintf("/api/todos/%d", todoID), nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Update", func(t *testing.T) {
		done := true
		w := httptest.NewRecorder()
		body := jsonBody(map[string]any{
			"title": "Buy bread",
			"done":  done,
		})
		req := httptest.NewRequest(http.MethodPatch,
			fmt.Sprintf("/api/todos/%d", todoID), body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var todo map[string]any
		parseJSON(t, w, &todo)
		assert.Equal(t, "Buy bread", todo["title"])
		assert.True(t, todo["done"].(bool))
	})

	t.Run("Delete", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodDelete,
			fmt.Sprintf("/api/todos/%d", todoID), nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Code)
	})

	t.Run("Get deleted", func(t *testing.T) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet,
			fmt.Sprintf("/api/todos/%d", todoID), nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("Create without title", func(t *testing.T) {
		w := httptest.NewRecorder()
		body := jsonBody(map[string]string{"description": "No title"})
		req := httptest.NewRequest(http.MethodPost, "/api/todos", body)
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
```

Run them:

```sh
go test ./e2e/ -v
```

## Run all tests

```sh
go test ./...
```
