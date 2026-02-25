# 4. Tasks domain

The `tasks` domain is fully self-contained. It has its own entity, repository, and DTOs, and enforces per-user ownership inside the service.

## Entity

```go
// internal/tasks/entities/task.entity.go
package task_entities

import "gorm.io/gorm"

type Task struct {
    gorm.Model
    Title       string `gorm:"not null"`
    Description string
    Done        bool `gorm:"default:false"`
    UserID      uint `gorm:"not null;index"`
}
```

`UserID` links a task to its owner. The index speeds up the `FindByUserID` query.

## Repository

```go
// internal/tasks/repositories/task.repository.go
package task_repositories

import (
    "github.com/go-minstack/repository"
    task_entities "task-api/internal/tasks/entities"
    "gorm.io/gorm"
)

type TaskRepository struct {
    *repository.Repository[task_entities.Task]
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
    return &TaskRepository{repository.NewRepository[task_entities.Task](db)}
}

func (r *TaskRepository) FindByUserID(userID uint) ([]task_entities.Task, error) {
    return r.FindAll(repository.Where("user_id = ?", userID))
}
```

## DTOs

```go
// internal/tasks/dto/task.dto.go
package dto

import task_entities "task-api/internal/tasks/entities"

type TaskDto struct {
    ID          uint   `json:"id"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Done        bool   `json:"done"`
    UserID      uint   `json:"user_id"`
}

func NewTaskDto(t *task_entities.Task) TaskDto {
    return TaskDto{
        ID:          t.ID,
        Title:       t.Title,
        Description: t.Description,
        Done:        t.Done,
        UserID:      t.UserID,
    }
}
```

```go
// internal/tasks/dto/create_task.dto.go
package dto

type CreateTaskDto struct {
    Title       string `json:"title"       binding:"required"`
    Description string `json:"description"`
}
```

```go
// internal/tasks/dto/update_task.dto.go
package dto

type UpdateTaskDto struct {
    Title       string `json:"title"`
    Description string `json:"description"`
    Done        *bool  `json:"done"`
}
```

`Done` is a pointer so the service can distinguish "not sent" from `false`.

## Service

```go
// internal/tasks/task.service.go
package tasks

import (
    "errors"
    "strconv"

    "github.com/go-minstack/auth"
    "task-api/internal/tasks/dto"
    task_entities "task-api/internal/tasks/entities"
    task_repos "task-api/internal/tasks/repositories"
)

type TaskService struct {
    tasks *task_repos.TaskRepository
}

func NewTaskService(tasks *task_repos.TaskRepository) *TaskService {
    return &TaskService{tasks: tasks}
}

func (s *TaskService) List(claims *auth.Claims) ([]dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    tasks, err := s.tasks.FindByUserID(uint(userID))
    if err != nil {
        return nil, err
    }
    dtos := make([]dto.TaskDto, len(tasks))
    for i, t := range tasks {
        dtos[i] = dto.NewTaskDto(&t)
    }
    return dtos, nil
}

func (s *TaskService) Create(claims *auth.Claims, input dto.CreateTaskDto) (*dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    task := &task_entities.Task{
        Title:       input.Title,
        Description: input.Description,
        UserID:      uint(userID),
    }
    if err := s.tasks.Create(task); err != nil {
        return nil, err
    }
    result := dto.NewTaskDto(task)
    return &result, nil
}

func (s *TaskService) Get(claims *auth.Claims, id uint) (*dto.TaskDto, error) {
    task, err := s.tasks.FindByID(id)
    if err != nil {
        return nil, err
    }
    if err := s.assertOwner(claims, task); err != nil {
        return nil, err
    }
    result := dto.NewTaskDto(task)
    return &result, nil
}

func (s *TaskService) Update(claims *auth.Claims, id uint, input dto.UpdateTaskDto) (*dto.TaskDto, error) {
    task, err := s.tasks.FindByID(id)
    if err != nil {
        return nil, err
    }
    if err := s.assertOwner(claims, task); err != nil {
        return nil, err
    }
    columns := map[string]interface{}{}
    if input.Title != "" {
        columns["title"] = input.Title
    }
    if input.Description != "" {
        columns["description"] = input.Description
    }
    if input.Done != nil {
        columns["done"] = *input.Done
    }
    if err := s.tasks.UpdatesByID(id, columns); err != nil {
        return nil, err
    }
    return s.Get(claims, id)
}

func (s *TaskService) Delete(claims *auth.Claims, id uint) error {
    task, err := s.tasks.FindByID(id)
    if err != nil {
        return err
    }
    if err := s.assertOwner(claims, task); err != nil {
        return err
    }
    return s.tasks.DeleteByID(id)
}

func (s *TaskService) assertOwner(claims *auth.Claims, task *task_entities.Task) error {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    if task.UserID != uint(userID) {
        return errors.New("forbidden")
    }
    return nil
}
```

`assertOwner` is a private helper called by every mutating operation. A task that belongs to another user returns `"forbidden"` — the controller maps this to `403`.

## Controller

```go
// internal/tasks/task.controller.go
package tasks

import (
    "errors"
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
    "github.com/go-minstack/web"
    "task-api/internal/tasks/dto"
)

type TaskController struct {
    service *TaskService
}

func NewTaskController(service *TaskService) *TaskController {
    return &TaskController{service: service}
}

func (c *TaskController) list(ctx *gin.Context) {
    claims, _ := auth.ClaimsFromContext(ctx)
    tasks, err := c.service.List(claims)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusOK, tasks)
}

func (c *TaskController) create(ctx *gin.Context) {
    var input dto.CreateTaskDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    claims, _ := auth.ClaimsFromContext(ctx)
    task, err := c.service.Create(claims, input)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusCreated, task)
}

func (c *TaskController) get(ctx *gin.Context) {
    id, err := parseID(ctx)
    if err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    claims, _ := auth.ClaimsFromContext(ctx)
    task, err := c.service.Get(claims, id)
    if err != nil {
        status := http.StatusNotFound
        if err.Error() == "forbidden" {
            status = http.StatusForbidden
        }
        ctx.JSON(status, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusOK, task)
}

func (c *TaskController) update(ctx *gin.Context) {
    id, err := parseID(ctx)
    if err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    var input dto.UpdateTaskDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    claims, _ := auth.ClaimsFromContext(ctx)
    task, err := c.service.Update(claims, id, input)
    if err != nil {
        status := http.StatusInternalServerError
        if err.Error() == "forbidden" {
            status = http.StatusForbidden
        }
        ctx.JSON(status, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusOK, task)
}

func (c *TaskController) delete(ctx *gin.Context) {
    id, err := parseID(ctx)
    if err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    claims, _ := auth.ClaimsFromContext(ctx)
    if err := c.service.Delete(claims, id); err != nil {
        status := http.StatusNotFound
        if err.Error() == "forbidden" {
            status = http.StatusForbidden
        }
        ctx.JSON(status, web.NewErrorDto(err))
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

```go
// internal/tasks/task.routes.go
package tasks

import (
    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
)

func RegisterRoutes(r *gin.Engine, c *TaskController, jwt *auth.JwtService) {
    g := r.Group("/api/tasks", auth.Authenticate(jwt))
    g.GET("", c.list)
    g.POST("", c.create)
    g.GET("/:id", c.get)
    g.PATCH("/:id", c.update)
    g.DELETE("/:id", c.delete)
}
```

`auth.Authenticate(jwt)` is applied at the group level — every route inside inherits it automatically.

## Module

```go
// internal/tasks/module.go
package tasks

import (
    "github.com/go-minstack/core"
    task_repos "task-api/internal/tasks/repositories"
)

func Register(app *core.App) {
    app.Provide(task_repos.NewTaskRepository)
    app.Provide(NewTaskService)
    app.Provide(NewTaskController)
    app.Invoke(RegisterRoutes)
}
```

---

Next: [Bootstrap](./bootstrap)
