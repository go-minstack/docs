# Todo API

Build a simple REST API with MinStack in minutes. This tutorial covers a single domain (todos), full CRUD, and — most importantly — how to write both **unit tests** and **E2E tests**.

## What you'll build

A **Todo API** with five endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/todos` | List all todos |
| POST | `/api/todos` | Create a todo |
| GET | `/api/todos/:id` | Get a todo |
| PATCH | `/api/todos/:id` | Update a todo |
| DELETE | `/api/todos/:id` | Delete a todo |

## Final folder layout

```
todo-api/
├── cmd/
│   └── main.go
├── internal/todos/
│   ├── entities/todo.entity.go
│   ├── repositories/todo.repository.go
│   ├── dto/
│   │   ├── todo.dto.go
│   │   ├── create_todo.dto.go
│   │   └── update_todo.dto.go
│   ├── todo.service.go
│   ├── todo.service_test.go
│   ├── todo.controller.go
│   ├── todo.routes.go
│   └── module.go
├── e2e/
│   └── e2e_test.go
├── go.mod
└── .env
```

## Steps

1. [Project Setup](./setup) — `go.mod`, `.env`, directory scaffold
2. [Todos domain](./todos) — entity, repository, DTOs, service, controller, routes, module
3. [Bootstrap](./bootstrap) — wiring everything in `main.go` and running the app
4. [Testing](./testing) — unit tests with mocks and E2E tests with `httptest`
