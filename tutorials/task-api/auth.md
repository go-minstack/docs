# 3. Auth domain

The `authn` domain has a single responsibility: validate credentials and issue a JWT. It has no entity or repository of its own — it depends on the users repository.

## Service

```go
// internal/authn/auth.service.go
package authn

import (
    "errors"
    "fmt"
    "time"

    "github.com/go-minstack/auth"
    "golang.org/x/crypto/bcrypt"
    "task-api/internal/users/dto"
    user_repos "task-api/internal/users/repositories"
)

type AuthService struct {
    users *user_repos.UserRepository
    jwt   *auth.JwtService
}

func NewAuthService(users *user_repos.UserRepository, jwt *auth.JwtService) *AuthService {
    return &AuthService{users: users, jwt: jwt}
}

func (s *AuthService) Login(input dto.LoginDto) (string, error) {
    user, err := s.users.FindByEmail(input.Email)
    if err != nil {
        return "", errors.New("invalid credentials")
    }
    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
        return "", errors.New("invalid credentials")
    }
    return s.jwt.Sign(auth.Claims{
        Subject: fmt.Sprintf("%d", user.ID),
        Name:    user.Name,
    }, 24*time.Hour)
}
```

Both a wrong email and a wrong password return the same `"invalid credentials"` error — this prevents user enumeration.

`auth.Claims.Subject` stores the user ID as a string. Protected endpoints parse it back to `uint` via `strconv.ParseUint`.

## DTO

```go
// internal/authn/dto/token.dto.go
package authn_dto

type TokenDto struct {
    Token string `json:"token"`
}
```

## Controller

```go
// internal/authn/auth.controller.go
package authn

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/web"
    authn_dto "task-api/internal/authn/dto"
    "task-api/internal/users/dto"
)

type AuthController struct {
    service *AuthService
}

func NewAuthController(service *AuthService) *AuthController {
    return &AuthController{service: service}
}

func (c *AuthController) login(ctx *gin.Context) {
    var input dto.LoginDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
        return
    }
    token, err := c.service.Login(input)
    if err != nil {
        ctx.JSON(http.StatusUnauthorized, web.NewErrorDto(err))
        return
    }
    ctx.JSON(http.StatusOK, authn_dto.TokenDto{Token: token})
}
```

## Routes

```go
// internal/authn/auth.routes.go
package authn

import "github.com/gin-gonic/gin"

func RegisterRoutes(r *gin.Engine, c *AuthController) {
    g := r.Group("/api/auth")
    g.POST("/login", c.login)
}
```

## Module

```go
// internal/authn/module.go
package authn

import "github.com/go-minstack/core"

func Register(app *core.App) {
    app.Provide(NewAuthService)
    app.Provide(NewAuthController)
    app.Invoke(RegisterRoutes)
}
```

The `UserRepository` that `NewAuthService` needs is already in the FX container from `users.Register`.

---

Next: [Tasks domain](./tasks)
