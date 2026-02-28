# 2. Todos domain

All files live under `internal/todos/`. We'll build the entity, repository, DTOs, service, controller, routes, and module registration.

## Entity

```
internal/todos/entities/todo.entity.go
```

```go
package todo_entities

import "gorm.io/gorm"

type Todo struct {
	gorm.Model
	Title       string `gorm:"not null"`
	Description string
	Done        bool   `gorm:"default:false"`
}
```

## Repository

```
internal/todos/repositories/todo.repository.go
```

```go
package todo_repositories

import (
	"github.com/go-minstack/repository"
	todo_entities "todo-api/internal/todos/entities"
	"gorm.io/gorm"
)

type TodoRepository struct {
	*repository.Repository[todo_entities.Todo]
}

func NewTodoRepository(db *gorm.DB) *TodoRepository {
	return &TodoRepository{repository.NewRepository[todo_entities.Todo](db)}
}
```

No custom queries needed — the generic `Repository` already provides `FindAll`, `FindByID`, `Create`, `UpdatesByID`, and `DeleteByID`.

## DTOs

```
internal/todos/dto/todo.todo_dto.go
```

```go
package todo_dto

import todo_entities "todo-api/internal/todos/entities"

type TodoDto struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

func NewTodoDto(t *todo_entities.Todo) TodoDto {
	return TodoDto{
		ID:          t.ID,
		Title:       t.Title,
		Description: t.Description,
		Done:        t.Done,
	}
}
```

```
internal/todos/dto/create_todo.todo_dto.go
```

```go
package todo_dto

type CreateTodoDto struct {
	Title       string `json:"title"       binding:"required"`
	Description string `json:"description"`
}
```

```
internal/todos/dto/update_todo.todo_dto.go
```

```go
package todo_dto

type UpdateTodoDto struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        *bool  `json:"done"`
}
```

`Done` is a pointer so we can distinguish "not sent" from `false`.

## Service

```
internal/todos/todo.service.go
```

```go
package todos

import (
	"log/slog"

	"github.com/go-minstack/repository"
	"todo-api/internal/todos/dto"
	todo_entities "todo-api/internal/todos/entities"
	todo_repos "todo-api/internal/todos/repositories"
)

type todoRepository interface {
	FindAll(opts ...repository.QueryOption) ([]todo_entities.Todo, error)
	FindByID(id uint) (*todo_entities.Todo, error)
	Create(entity *todo_entities.Todo) error
	UpdatesByID(id uint, columns map[string]interface{}) error
	DeleteByID(id uint) error
}

type TodoService struct {
	todos todoRepository
	log   *slog.Logger
}

func NewTodoService(todos *todo_repos.TodoRepository, log *slog.Logger) *TodoService {
	return &TodoService{todos: todos, log: log}
}

func (s *TodoService) List() ([]todo_dto.TodoDto, error) {
	todos, err := s.todos.FindAll()
	if err != nil {
		s.log.Error("failed to list todos", "error", err)
		return nil, err
	}
	s.log.Info("listed todos", "count", len(todos))
	dtos := make([]todo_dto.TodoDto, len(todos))
	for i, t := range todos {
		dtos[i] = todo_dto.NewTodoDto(&t)
	}
	return dtos, nil
}

func (s *TodoService) Create(input todo_dto.CreateTodoDto) (*todo_dto.TodoDto, error) {
	todo := &todo_entities.Todo{
		Title:       input.Title,
		Description: input.Description,
	}
	if err := s.todos.Create(todo); err != nil {
		s.log.Error("failed to create todo", "error", err)
		return nil, err
	}
	s.log.Info("todo created", "todo_id", todo.ID)
	result := todo_dto.NewTodoDto(todo)
	return &result, nil
}

func (s *TodoService) Get(id uint) (*todo_dto.TodoDto, error) {
	todo, err := s.todos.FindByID(id)
	if err != nil {
		s.log.Error("todo not found", "todo_id", id)
		return nil, err
	}
	result := todo_dto.NewTodoDto(todo)
	return &result, nil
}

func (s *TodoService) Update(id uint, input todo_dto.UpdateTodoDto) (*todo_dto.TodoDto, error) {
	todo, err := s.todos.FindByID(id)
	if err != nil {
		return nil, err
	}

	columns := map[string]interface{}{}
	if input.Title != "" {
		columns["title"] = input.Title
		todo.Title = input.Title
	}
	if input.Description != "" {
		columns["description"] = input.Description
		todo.Description = input.Description
	}
	if input.Done != nil {
		columns["done"] = *input.Done
		todo.Done = *input.Done
	}
	if err := s.todos.UpdatesByID(id, columns); err != nil {
		s.log.Error("failed to update todo", "todo_id", id, "error", err)
		return nil, err
	}

	s.log.Info("todo updated", "todo_id", id)
	result := todo_dto.NewTodoDto(todo)
	return &result, nil
}

func (s *TodoService) Delete(id uint) error {
	if _, err := s.todos.FindByID(id); err != nil {
		s.log.Error("todo not found for deletion", "todo_id", id)
		return err
	}
	if err := s.todos.DeleteByID(id); err != nil {
		s.log.Error("failed to delete todo", "todo_id", id, "error", err)
		return err
	}
	s.log.Info("todo deleted", "todo_id", id)
	return nil
}
```

Notice the **`todoRepository` interface** at the top. The struct field uses this interface, but the constructor accepts the concrete `*TodoRepository` — FX injects the real implementation, which satisfies the interface automatically. This enables [unit testing with mocks](./testing).

`*slog.Logger` is injected by FX alongside the repository. Because `core.New()` always includes `logger.Module()`, adding it to the constructor is the only change needed — no extra wiring in `main.go`.

## Controller

```
internal/todos/todo.controller.go
```

```go
package todos

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/go-minstack/web"
	"todo-api/internal/todos/dto"
)

type TodoController struct {
	service *TodoService
}

func NewTodoController(service *TodoService) *TodoController {
	return &TodoController{service: service}
}

func (c *TodoController) list(ctx *gin.Context) {
	todos, err := c.service.List()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, web.NewErrorDto(err))
		return
	}
	ctx.JSON(http.StatusOK, todos)
}

func (c *TodoController) create(ctx *gin.Context) {
	var input todo_dto.CreateTodoDto
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
		return
	}
	todo, err := c.service.Create(input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, web.NewErrorDto(err))
		return
	}
	ctx.JSON(http.StatusCreated, todo)
}

func (c *TodoController) get(ctx *gin.Context) {
	id, err := parseID(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
		return
	}
	todo, err := c.service.Get(id)
	if err != nil {
		ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
		return
	}
	ctx.JSON(http.StatusOK, todo)
}

func (c *TodoController) update(ctx *gin.Context) {
	id, err := parseID(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
		return
	}
	var input todo_dto.UpdateTodoDto
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
		return
	}
	todo, err := c.service.Update(id, input)
	if err != nil {
		ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
		return
	}
	ctx.JSON(http.StatusOK, todo)
}

func (c *TodoController) delete(ctx *gin.Context) {
	id, err := parseID(ctx)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
		return
	}
	if err := c.service.Delete(id); err != nil {
		ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
		return
	}
	ctx.Status(http.StatusNoContent)
}

func parseID(ctx *gin.Context) (uint, error) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		return 0, errors.New("invalid id")
	}
	return uint(id), nil
}
```

## Routes

```
internal/todos/todo.routes.go
```

```go
package todos

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, c *TodoController) {
	g := r.Group("/api/todos")
	g.GET("", c.list)
	g.POST("", c.create)
	g.GET("/:id", c.get)
	g.PATCH("/:id", c.update)
	g.DELETE("/:id", c.delete)
}
```

## Module

```
internal/todos/module.go
```

```go
package todos

import (
	"github.com/go-minstack/core"
	todo_repos "todo-api/internal/todos/repositories"
)

func Register(app *core.App) {
	app.Provide(todo_repos.NewTodoRepository)
	app.Provide(NewTodoService)
	app.Provide(NewTodoController)
	app.Invoke(RegisterRoutes)
}
```

---

Next: [Bootstrap](./bootstrap)
