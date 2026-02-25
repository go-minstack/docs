# auth

JWT authentication module for MinStack. Provides RSA or HMAC token signing and validation, plus composable gin middleware for route protection with role-based access control.

## Installation

```sh
go get github.com/go-minstack/auth
```

## Usage

### Bootstrap (`cmd/main.go`)

```go
package main

import (
    "github.com/go-minstack/auth"
    "github.com/go-minstack/core"
    mgin "github.com/go-minstack/gin"
    "github.com/go-minstack/logger"
    "github.com/example/app/internal/users"
)

func main() {
    app := core.New(mgin.Module(), logger.Module(), auth.Module())

    app.Provide(users.NewUserController)
    app.Invoke(users.RegisterRoutes)

    app.Run()
}
```

### DTOs (`dto/`)

```go
// dto/login_request.dto.go
package dto

type LoginRequestDto struct {
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required"`
}
```

```go
// dto/error.dto.go
package dto

type ErrorDto struct {
    Error string `json:"error"`
}

func NewErrorDto(err error) ErrorDto {
    return ErrorDto{Error: err.Error()}
}
```

```go
// dto/message.dto.go
package dto

type MessageDto struct {
    Message string `json:"message"`
}

func NewMessageDto(message string) MessageDto {
    return MessageDto{Message: message}
}
```

```go
// dto/login_response.dto.go
package dto

type LoginResponseDto struct {
    Token     string `json:"token"`
    ExpiresIn int64  `json:"expires_in"`
}

func NewLoginResponseDto(token string, expiresInSeconds int64) LoginResponseDto {
    return LoginResponseDto{Token: token, ExpiresIn: expiresInSeconds}
}
```

```go
// dto/profile.dto.go
package dto

import "github.com/go-minstack/auth"

type ProfileDto struct {
    Subject string   `json:"subject"`
    Name    string   `json:"name"`
    Roles   []string `json:"roles"`
}

func NewProfileDto(claims *auth.Claims) ProfileDto {
    return ProfileDto{Subject: claims.Subject, Name: claims.Name, Roles: claims.Roles}
}
```

### Routes (`user.routes.go`)

Apply `Authenticate` at the group level once. Use `RequireRole` per route for fine-grained access control.

```go
package users

import (
    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
)

func RegisterRoutes(r *gin.Engine, c *UserController, svc *auth.JwtService) {
    r.POST("/api/users/login", c.login)

    protected := r.Group("/api/users", auth.Authenticate(svc))
    protected.GET("/profile", c.profile)
    protected.GET("/admin", auth.RequireRole("admin"), c.adminOnly)
}
```

### Controller (`user.controller.go`)

```go
package users

import (
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/go-minstack/auth"
    "github.com/example/app/internal/users/dto"
)

const tokenExpiry = time.Hour

type UserController struct {
    svc *auth.JwtService
}

func NewUserController(svc *auth.JwtService) *UserController {
    return &UserController{svc: svc}
}

func (c *UserController) login(ctx *gin.Context) {
    var input dto.LoginRequestDto
    if err := ctx.ShouldBindJSON(&input); err != nil {
        ctx.JSON(http.StatusBadRequest, dto.NewErrorDto(err))
        return
    }

    // In a real app: look up the user and verify the password.
    token, err := c.svc.Sign(auth.Claims{
        Subject: "user-123",
        Name:    "Alice",
        Roles:   []string{"user"},
    }, tokenExpiry)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, dto.NewErrorDto(err))
        return
    }

    ctx.JSON(http.StatusOK, dto.NewLoginResponseDto(token, int64(tokenExpiry.Seconds())))
}

func (c *UserController) profile(ctx *gin.Context) {
    claims, _ := auth.ClaimsFromContext(ctx)
    ctx.JSON(http.StatusOK, dto.NewProfileDto(claims))
}

func (c *UserController) adminOnly(ctx *gin.Context) {
    ctx.JSON(http.StatusOK, dto.NewMessageDto("welcome, admin"))
}
```

## API

### `auth.Module() fx.Option`
Registers `*JwtService` into the DI container. Keys are loaded from environment variables during the FX `OnStart` lifecycle hook.

### `auth.Authenticate(svc *JwtService) gin.HandlerFunc`
Validates the `Authorization: Bearer <token>` header and stores the claims in the gin context. Returns `401 Unauthorized` on failure.

### `auth.RequireRole(roles ...string) gin.HandlerFunc`
Checks that the authenticated user has at least one of the given roles. Must run after `Authenticate`. Returns `403 Forbidden` on failure.

### `auth.ClaimsFromContext(c *gin.Context) (*Claims, bool)`
Returns the claims set by `Authenticate`, or `false` if not present.

### `(*JwtService).Sign(claims Claims, expiry time.Duration) (string, error)`
Creates a signed JWT. Requires `MINSTACK_JWT_PRIVATE_KEY` (RSA) or `MINSTACK_JWT_SECRET` (HMAC).

### `(*JwtService).Validate(token string) (*Claims, error)`
Parses and validates a JWT. Requires any verification key.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MINSTACK_JWT_PRIVATE_KEY` | Path to RSA private key PEM — enables `Sign` + `Validate` |
| `MINSTACK_JWKS_URL` | JWKS endpoint — fetches RSA public key on start (verify-only) |
| `MINSTACK_JWT_PUBLIC_KEY` | Path to RSA public key PEM — fallback after JWKS, also used as cache |
| `MINSTACK_JWT_SECRET` | HMAC secret string — ⚠ not recommended for production |

**Key loading priority:**
1. `MINSTACK_JWT_PRIVATE_KEY` — RSA private key (public key derived automatically)
2. `MINSTACK_JWKS_URL` — fetch RSA public key from JWKS endpoint
3. `MINSTACK_JWT_PUBLIC_KEY` — RSA public key from file
4. `MINSTACK_JWT_SECRET` — HMAC HS256

## Notes

- Use RSA keys whenever you sign tokens — HMAC secrets cannot be rotated safely across services
- Apply `Authenticate` once on a route group, `RequireRole` per route as needed
- When `MINSTACK_JWKS_URL` is set and `MINSTACK_JWT_PUBLIC_KEY` is configured, the fetched key is cached to the file for faster restarts
