# 1. Project Setup

Create the project directory and scaffold the module.

## go.mod

```
task-api/
├── cmd/
│   └── main.go
├── internal/
│   ├── users/
│   ├── auth/
│   └── tasks/
├── go.mod
└── .env
```

```sh
mkdir -p task-api/cmd
mkdir -p task-api/internal/{users,auth,tasks}
cd task-api
go mod init task-api
```

Install all dependencies with `go get`:

```sh
go get github.com/go-minstack/core
go get github.com/go-minstack/gin
go get github.com/go-minstack/sqlite
go get github.com/go-minstack/auth
go get github.com/go-minstack/repository
go get github.com/go-minstack/web
go get golang.org/x/crypto
go get gorm.io/gorm
```

## .env

```ini
MINSTACK_DB_URL=task-api.db
MINSTACK_JWT_SECRET=super-secret-key-change-in-production
MINSTACK_PORT=8080
```

`MINSTACK_DB_URL` is the SQLite file path. `MINSTACK_JWT_SECRET` is the HMAC key used by `auth.Module()` to sign JWTs. For production, use RSA keys instead — see the [auth module docs](/modules/auth).

---

Next: [Users domain](./users)
