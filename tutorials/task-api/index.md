# Task API

Build a complete REST API from scratch using MinStack. By the end you'll have a running service with user registration, JWT authentication, and full task CRUD — all organised with the domain structure pattern.

## What you'll build

A **Task API** with three domains:

| Domain | Responsibility |
|--------|----------------|
| `users` | Register an account, fetch your profile |
| `auth` | Login and receive a JWT |
| `tasks` | Create, list, update, and delete your tasks |

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/register` | — | Create account |
| GET | `/api/users/me` | JWT | Get current user |
| POST | `/api/auth/login` | — | Login, receive JWT |
| GET | `/api/tasks` | JWT | List your tasks |
| POST | `/api/tasks` | JWT | Create a task |
| GET | `/api/tasks/:id` | JWT | Get a task |
| PATCH | `/api/tasks/:id` | JWT | Update a task |
| DELETE | `/api/tasks/:id` | JWT | Delete a task |

## Final folder layout

```
task-api/
├── cmd/
│   └── main.go
├── internal/
│   ├── users/
│   │   ├── entities/user.entity.go
│   │   ├── repositories/user.repository.go
│   │   ├── dto/
│   │   │   ├── user.dto.go
│   │   │   ├── register.dto.go
│   │   │   └── login.dto.go
│   │   ├── user.service.go
│   │   ├── user.controller.go
│   │   ├── user.routes.go
│   │   └── module.go
│   ├── auth/
│   │   ├── auth.service.go
│   │   ├── auth.controller.go
│   │   ├── auth.routes.go
│   │   └── module.go
│   └── tasks/
│       ├── entities/task.entity.go
│       ├── repositories/task.repository.go
│       ├── dto/
│       │   ├── task.dto.go
│       │   ├── create_task.dto.go
│       │   └── update_task.dto.go
│       ├── task.service.go
│       ├── task.controller.go
│       ├── task.routes.go
│       └── module.go
├── go.mod
└── .env
```

## Steps

1. [Project Setup](./setup) — `go.mod`, `.env`, directory scaffold
2. [Users domain](./users) — entity, repository, DTOs, service, controller, routes, module
3. [Auth domain](./auth) — login service, controller, routes, module
4. [Tasks domain](./tasks) — entity, repository, DTOs, service, controller, routes, module
5. [Bootstrap](./bootstrap) — wiring everything in `main.go` and running the app
