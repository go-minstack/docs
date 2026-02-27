# 2. Users domain

The `users` domain owns the `User` entity and exposes two endpoints: register and get the current user's profile.

## Entity

```go
// internal/users/entities/user.entity.go
package user_entities

import "gorm.io/gorm"

type User struct {
    gorm.Model
    Name     string `gorm:"not null"`
    Email    string `gorm:"uniqueIndex;not null"`
    Password string `gorm:"not null"`
}
```

The `Password` field stores a bcrypt hash — never the plaintext value.

## Repository

```go
// internal/users/repositories/user.repository.go
package user_repositories

import (
    "github.com/go-minstack/repository"
    user_entities "task-api/internal/users/entities"
    "gorm.io/gorm"
)

type UserRepository struct {
    *repository.Repository[user_entities.User]
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{repository.NewRepository[user_entities.User](db)}
}

func (r *UserRepository) FindByEmail(email string) (*user_entities.User, error) {
    return r.FindOne(repository.Where("email = ?", email))
}
```

`FindByEmail` is a domain-specific query used by the auth service at login. It lives here — not in the service — so the service never touches `*gorm.DB` directly.

## DTOs

```go
// internal/users/dto/user.user_dto.go
package user_dto

import user_entities "task-api/internal/users/entities"

type UserDto struct {
    ID    uint   `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

func NewUserDto(u *user_entities.User) UserDto {
    return UserDto{ID: u.ID, Name: u.Name, Email: u.Email}
}
```

```go
// internal/users/dto/register.user_dto.go
package user_dto

type RegisterDto struct {
    Name     string `json:"name"     binding:"required"`
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
}
```

```go
// internal/users/dto/login.user_dto.go
package user_dto

type LoginDto struct {
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required"`
}
```

`LoginDto` lives in the `users/dto` package because it describes user credentials. The `auth` domain imports it — there is no duplication.

## Service

```go
// internal/users/user.service.go
package users

import (
    "golang.org/x/crypto/bcrypt"
    "task-api/internal/users/dto"
    user_entities "task-api/internal/users/entities"
    user_repos "task-api/internal/users/repositories"
)

type UserService struct {
    users *user_repos.UserRepository
}

func NewUserService(users *user_repos.UserRepository) *UserService {
    return &UserService{users: users}
}

func (s *UserService) Register(input user_dto.RegisterDto) (*user_dto.UserDto, error) {
    hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, err
    }
    user := &user_entities.User{
        Name:     input.Name,
        Email:    input.Email,
        Password: string(hash),
    }
    if err := s.users.Create(user); err != nil {
        return nil, err
    }
    result := user_dto.NewUserDto(user)
    return &result, nil
}

func (s *UserService) Me(id uint) (*user_dto.UserDto, error) {
    user, err := s.users.FindByID(id)
    if err != nil {
        return nil, err
    }
    result := user_dto.NewUserDto(user)
    return &result, nil
}
```

## Controller

```go
// internal/users/user.controller.go
package users

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
    "github.com/go-minstack/web"
    "task-api/internal/users/dto"
)

type UserController struct {
    service *UserService
}

func NewUserController(service *UserService) *UserController {
    return &UserController{service: service}
}

func (c *UserController) register(ctx *gin.Context) {
    var input user_dto.RegisterDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    user, err := c.service.Register(input)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusCreated, user)
}

func (c *UserController) me(ctx *gin.Context) {
    claims, _ := auth.ClaimsFromContext(ctx)
    id, _ := strconv.ParseUint(claims.Subject, 10, 64)
    user, err := c.service.Me(uint(id))
    if err != nil {
        ctx.JSON(http.StatusNotFound, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusOK, user)
}
```

`me` extracts the user ID from the JWT claims set by `auth.Authenticate`. The `Subject` field is the user's ID stored as a string at login time.

## Routes

```go
// internal/users/user.routes.go
package users

import (
    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
)

func RegisterRoutes(r *gin.Engine, c *UserController, jwt *auth.JwtService) {
    g := r.Group("/api/users")
    g.POST("/register", c.register)
    g.GET("/me", auth.Authenticate(jwt), c.me)
}
```

`/register` is public. `/me` uses `auth.Authenticate` as per-route middleware so only that endpoint requires a JWT.

## Module

```go
// internal/users/module.go
package users

import (
    "github.com/go-minstack/core"
    user_repos "task-api/internal/users/repositories"
)

func Register(app *core.App) {
    app.Provide(user_repos.NewUserRepository)
    app.Provide(NewUserService)
    app.Provide(NewUserController)
    app.Invoke(RegisterRoutes)
}
```

---

Next: [Auth domain](./auth)
