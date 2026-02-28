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

func (r *TaskRepository) FindByIDAndUserID(id, userID uint) (*task_entities.Task, error) {
    return r.FindOne(repository.Where("id = ? AND user_id = ?", id, userID))
}
```

`FindByIDAndUserID` queries both columns in a single round-trip. If the task does not exist **or** belongs to a different user, GORM returns record-not-found — the caller never learns which case applied.

## DTOs

```go
// internal/tasks/dto/task.task_dto.go
package task_dto

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
// internal/tasks/dto/create_task.task_dto.go
package task_dto

type CreateTaskDto struct {
    Title       string `json:"title"       binding:"required"`
    Description string `json:"description"`
}
```

```go
// internal/tasks/dto/update_task.task_dto.go
package task_dto

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
    "log/slog"
    "strconv"

    "github.com/go-minstack/auth"
    "task-api/internal/tasks/dto"
    task_entities "task-api/internal/tasks/entities"
    task_repos "task-api/internal/tasks/repositories"
)

type TaskService struct {
    tasks *task_repos.TaskRepository
    log   *slog.Logger
}

func NewTaskService(tasks *task_repos.TaskRepository, log *slog.Logger) *TaskService {
    return &TaskService{tasks: tasks, log: log}
}

func (s *TaskService) List(claims *auth.Claims) ([]task_dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    tasks, err := s.tasks.FindByUserID(uint(userID))
    if err != nil {
        s.log.Error("failed to list tasks", "user_id", userID, "error", err)
        return nil, err
    }
    s.log.Info("listed tasks", "user_id", userID, "count", len(tasks))
    dtos := make([]task_dto.TaskDto, len(tasks))
    for i, t := range tasks {
        dtos[i] = task_dto.NewTaskDto(&t)
    }
    return dtos, nil
}

func (s *TaskService) Create(claims *auth.Claims, input task_dto.CreateTaskDto) (*task_dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    task := &task_entities.Task{
        Title:       input.Title,
        Description: input.Description,
        UserID:      uint(userID),
    }
    if err := s.tasks.Create(task); err != nil {
        s.log.Error("failed to create task", "user_id", userID, "error", err)
        return nil, err
    }
    s.log.Info("task created", "task_id", task.ID, "user_id", userID)
    result := task_dto.NewTaskDto(task)
    return &result, nil
}

func (s *TaskService) Get(claims *auth.Claims, id uint) (*task_dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    task, err := s.tasks.FindByIDAndUserID(id, uint(userID))
    if err != nil {
        s.log.Error("task not found", "task_id", id, "user_id", userID)
        return nil, err
    }
    result := task_dto.NewTaskDto(task)
    return &result, nil
}

func (s *TaskService) Update(claims *auth.Claims, id uint, input task_dto.UpdateTaskDto) (*task_dto.TaskDto, error) {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    task, err := s.tasks.FindByIDAndUserID(id, uint(userID))
    if err != nil {
        return nil, err
    }
    columns := map[string]interface{}{}
    if input.Title != "" {
        columns["title"] = input.Title
        task.Title = input.Title
    }
    if input.Description != "" {
        columns["description"] = input.Description
        task.Description = input.Description
    }
    if input.Done != nil {
        columns["done"] = *input.Done
        task.Done = *input.Done
    }
    if err := s.tasks.UpdatesByID(id, columns); err != nil {
        s.log.Error("failed to update task", "task_id", id, "error", err)
        return nil, err
    }
    s.log.Info("task updated", "task_id", id, "user_id", userID)
    result := task_dto.NewTaskDto(task)
    return &result, nil
}

func (s *TaskService) Delete(claims *auth.Claims, id uint) error {
    userID, _ := strconv.ParseUint(claims.Subject, 10, 64)
    if _, err := s.tasks.FindByIDAndUserID(id, uint(userID)); err != nil {
        s.log.Error("task not found for deletion", "task_id", id, "user_id", userID)
        return err
    }
    if err := s.tasks.DeleteByID(id); err != nil {
        s.log.Error("failed to delete task", "task_id", id, "error", err)
        return err
    }
    s.log.Info("task deleted", "task_id", id, "user_id", userID)
    return nil
}
```

`*slog.Logger` is injected by FX — `core.New()` includes `logger.Module()` automatically, so adding it to the constructor is enough.

`FindByIDAndUserID` replaces the two-step fetch-then-assert pattern. The controller no longer needs to distinguish "not found" from "forbidden" — both cases return 404.

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
    var input task_dto.CreateTaskDto
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
        ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
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
    var input task_dto.UpdateTaskDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    claims, _ := auth.ClaimsFromContext(ctx)
    task, err := c.service.Update(claims, id, input)
    if err != nil {
        ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
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
