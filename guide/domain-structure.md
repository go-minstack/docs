# Domain Structure

MinStack is opinionated about how you organise your code. Each feature lives in its own self-contained domain folder with clear separation between data, logic, and HTTP.

## File naming

Files follow a `<name>.<role>.go` suffix convention. This makes the role of every file immediately obvious when scanning a folder.

| Suffix | Role |
|--------|------|
| `user.entity.go` | GORM model |
| `user.repository.go` | Repository wrapper + domain queries |
| `user.user_dto.go` | Response DTO |
| `create_user.user_dto.go` | Input DTO |
| `user.service.go` | Business logic |
| `user.controller.go` | HTTP handlers |
| `user.routes.go` | Route registration |

## Folder layout

```
cmd/
└── main.go                         # Bootstrap — wires all domains together

internal/
└── users/                          # One folder per domain
    ├── entities/
    │   └── user.entity.go          # GORM model
    ├── repositories/
    │   └── user.repository.go      # Typed Repository wrapper + domain queries
    ├── dto/
    │   ├── user.user_dto.go             # Response DTO + constructor
    │   └── create_user.user_dto.go      # Input DTO
    ├── user.service.go             # Business logic
    ├── user.controller.go          # HTTP handlers
    └── user.routes.go              # Route registration
```

Each layer has a single responsibility. Nothing leaks across boundaries.

---

## Layer by layer

### 1. Entity (`entities/user.entity.go`)

Defines only the GORM model. No query logic lives here.

**With `gorm.Model` (uint primary key — default):**

```go
package user_entities

import "gorm.io/gorm"

type User struct {
    gorm.Model
    Name  string `gorm:"not null"`
    Email string `gorm:"uniqueIndex;not null"`
}
```

**With `UuidModel` (UUID primary key — optional):**

```go
package user_entities

import "github.com/go-minstack/postgres"

type User struct {
    postgres.UuidModel
    Name  string `gorm:"not null"`
    Email string `gorm:"uniqueIndex;not null"`
}
```

### 2. Repository (`repositories/user.repository.go`)

Wraps the generic repository and adds domain-specific queries.

**With `gorm.Model`:**

```go
package user_repositories

import (
    "github.com/go-minstack/repository"
    user_entities "github.com/example/app/internal/users/entities"
    "gorm.io/gorm"
)

type UserRepository struct {
    *repository.Repository[user_entities.User]
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{repository.NewRepository[user_entities.User](db)}
}

// Domain-specific query — goes here, not in the service
func (r *UserRepository) FindByEmail(email string) (*user_entities.User, error) {
    return r.FindOne(repository.Where("email = ?", email))
}
```

**With `UuidModel`:**

```go
package user_repositories

import (
    "github.com/go-minstack/repository"
    user_entities "github.com/example/app/internal/users/entities"
    "gorm.io/gorm"
)

type UserRepository struct {
    *repository.UuidRepository[user_entities.User]
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{repository.NewUuidRepository[user_entities.User](db)}
}

// Domain-specific query — goes here, not in the service
func (r *UserRepository) FindByEmail(email string) (*user_entities.User, error) {
    return r.FindOne(repository.Where("email = ?", email))
}
```

### 3. DTOs (`dto/`)

DTOs decouple your API contract from your database model. Never expose the entity directly.

**With `gorm.Model` (uint primary key — default):**

```go
// dto/user.user_dto.go
package user_dto

import user_entities "github.com/example/app/internal/users/entities"

type UserDto struct {
    ID    uint   `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

func NewUserDto(u *user_entities.User) UserDto {
    return UserDto{
        ID:    u.ID,
        Name:  u.Name,
        Email: u.Email,
    }
}
```

**With `UuidModel` (UUID primary key — optional):**

```go
// dto/user.user_dto.go
package user_dto

import (
    "github.com/google/uuid"
    user_entities "github.com/example/app/internal/users/entities"
)

type UserDto struct {
    ID    uuid.UUID `json:"id"`
    Name  string    `json:"name"`
    Email string    `json:"email"`
}

func NewUserDto(u *user_entities.User) UserDto {
    return UserDto{
        ID:    u.ID,
        Name:  u.Name,
        Email: u.Email,
    }
}
```

```go
// dto/create_user.user_dto.go
package user_dto

type CreateUserDto struct {
    Name  string `json:"name"  binding:"required"`
    Email string `json:"email" binding:"required,email"`
}
```

### 4. Service (`user.service.go`)

Contains all business logic. Depends on the repository — never on `*gorm.DB` directly.

```go
package users

import (
    "github.com/go-minstack/repository"
    "github.com/example/app/internal/users/dto"
    user_entities "github.com/example/app/internal/users/entities"
    user_repos "github.com/example/app/internal/users/repositories"
)

type UserService struct {
    users *user_repos.UserRepository
}

func NewUserService(users *user_repos.UserRepository) *UserService {
    return &UserService{users: users}
}

func (s *UserService) Create(input user_dto.CreateUserDto) (*user_dto.UserDto, error) {
    user := &user_entities.User{
        Name:  input.Name,
        Email: input.Email,
    }
    if err := s.users.Create(user); err != nil {
        return nil, err
    }
    result := user_dto.NewUserDto(user)
    return &result, nil
}

func (s *UserService) List() ([]user_dto.UserDto, error) {
    users, err := s.users.FindAll(repository.Order("name"))
    if err != nil {
        return nil, err
    }
    dtos := make([]user_dto.UserDto, len(users))
    for i, u := range users {
        dtos[i] = user_dto.NewUserDto(&u)
    }
    return dtos, nil
}
```

### 5. Controller (`user.controller.go`)

Thin HTTP layer. Extracts input, calls the service, returns the response. No business logic here.

```go
package users

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/example/app/internal/users/dto"
)

type UserController struct {
    service *UserService
}

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) list(ctx *gin.Context) {
    users, err := c.service.List()
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    ctx.JSON(http.StatusOK, users)
}

func (c *UserController) create(ctx *gin.Context) {
    var input user_dto.CreateUserDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    user, err := c.service.Create(input)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    ctx.JSON(http.StatusCreated, user)
}
```

### 6. Routes (`user.routes.go`)

Registers all endpoints for the domain. Called via `app.Invoke` at startup.

```go
package users

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, c *UserController) {
    g := r.Group("/api/users")
    g.GET("",  c.list)
    g.POST("", c.create)
}
```

---

## Bootstrap (`cmd/main.go`)

Wire everything together in `main.go`. FX resolves all dependencies automatically.

```go
package main

import (
    "github.com/go-minstack/core"
    mgin "github.com/go-minstack/gin"
    "github.com/go-minstack/postgres"
    "github.com/example/app/internal/users"
    user_entities "github.com/example/app/internal/users/entities"
    user_repos "github.com/example/app/internal/users/repositories"
    "gorm.io/gorm"
)

func migrate(db *gorm.DB) error {
    return db.AutoMigrate(&user_entities.User{})
}

func main() {
    app := core.New(mgin.Module(), postgres.Module())

    // users domain
    app.Provide(user_repos.NewUserRepository)
    app.Provide(users.NewUserService)
    app.Provide(users.NewUserController)
    app.Invoke(users.RegisterRoutes)
    app.Invoke(migrate)

    app.Run()
}
```

Adding a second domain is just four more lines following the same pattern.

---

## Rules of thumb

| Rule | Why |
|------|-----|
| Never expose entities in HTTP responses | DTOs let you evolve the DB schema independently of the API |
| Keep business logic in the service | Controllers stay thin and testable |
| Domain queries go in the repository | Services don't touch `*gorm.DB` directly |
| One `RegisterRoutes` per domain | Easy to find and reason about routing |
| Follow the `<name>.<role>.go` naming | Role is visible at a glance without opening the file |
