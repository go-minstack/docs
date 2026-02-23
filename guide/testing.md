# Testing

MinStack apps are straightforward to test because FX manages the wiring. Use `app.Start` / `app.Stop` instead of `app.Run` to keep tests non-blocking, and use SQLite in-memory to avoid Docker dependencies.

## Core pattern

```go
func TestSomething(t *testing.T) {
    t.Setenv("DB_URL", ":memory:")

    app := core.New(sqlite.Module())
    app.Provide(NewUserRepository)
    app.Provide(NewUserService)

    var svc *UserService
    app.Invoke(func(s *UserService) { svc = s })

    ctx := context.Background()
    require.NoError(t, app.Start(ctx))
    t.Cleanup(func() { app.Stop(ctx) })

    // test svc...
}
```

**Key points:**
- `t.Setenv` — sets env vars scoped to the test, automatically restored after
- `app.Start(ctx)` — builds the FX graph and runs `OnStart` hooks without blocking
- `t.Cleanup` — ensures `app.Stop` is called even if the test fails
- `sqlite.Module()` + `:memory:` — fast, isolated, no external process needed

---

## Testing a service

```go
func TestUserService_Create(t *testing.T) {
    t.Setenv("DB_URL", ":memory:")

    app := core.New(sqlite.Module())
    app.Provide(user_entities.NewUserRepository)
    app.Provide(users.NewUserService)

    var svc *users.UserService
    app.Invoke(func(s *users.UserService) { svc = s })

    ctx := context.Background()
    require.NoError(t, app.Start(ctx))
    t.Cleanup(func() { app.Stop(ctx) })

    // migrate
    var db *gorm.DB
    app.Invoke(func(d *gorm.DB) { db = d })
    db.AutoMigrate(&user_entities.User{})

    // test
    user, err := svc.Create(dto.CreateUserDto{
        Name:  "Alice",
        Email: "alice@example.com",
    })
    require.NoError(t, err)
    assert.Equal(t, "Alice", user.Name)
    assert.NotEmpty(t, user.ID)
}
```

---

## Testing a controller (httptest)

Use `httptest.NewRecorder` to test HTTP handlers without starting a real server.

```go
func TestUserController_List(t *testing.T) {
    t.Setenv("DB_URL", ":memory:")

    app := core.New(sqlite.Module())
    app.Provide(user_entities.NewUserRepository)
    app.Provide(users.NewUserService)
    app.Provide(users.NewUserController)

    var ctrl *users.UserController
    app.Invoke(func(c *users.UserController) { ctrl = c })

    ctx := context.Background()
    require.NoError(t, app.Start(ctx))
    t.Cleanup(func() { app.Stop(ctx) })

    // set up a minimal gin router
    gin.SetMode(gin.TestMode)
    r := gin.New()
    r.GET("/users", ctrl.List)

    // fire a request
    w := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodGet, "/users", nil)
    r.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

---

## Testing with real databases

When you need PostgreSQL or MySQL-specific behaviour (JSON columns, full-text search, etc.), use Docker in CI and point `DB_URL` at the real service:

```sh
# Run tests against a local Postgres instance
DB_URL="host=localhost user=minstack password=minstack dbname=minstack_test sslmode=disable" \
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
| `net/http/httptest` | Standard library — recorder + request for controller tests |
