# 1. Project Setup

Create the project directory and scaffold the module.

## go.mod

```
todo-api/
├── cmd/
│   └── main.go
├── internal/todos/
├── e2e/
├── go.mod
└── .env
```

```sh
mkdir -p todo-api/cmd
mkdir -p todo-api/internal/todos
mkdir -p todo-api/e2e
cd todo-api
go mod init todo-api
```

Install dependencies:

```sh
go get github.com/go-minstack/core
go get github.com/go-minstack/gin
go get github.com/go-minstack/sqlite
go get github.com/go-minstack/repository
go get github.com/go-minstack/web
go get gorm.io/gorm
```

## .env

```ini
MINSTACK_DB_URL=todo-api.db
```

`MINSTACK_DB_URL` is the SQLite file path. No auth modules needed for this tutorial.

---

Next: [Todos domain](./todos)
