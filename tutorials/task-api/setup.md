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

The only external dependencies you need to declare directly are `gorm.io/gorm` (for entity types) and `golang.org/x/crypto` (for bcrypt). Everything else — `core`, `gin`, `sqlite`, `auth`, `repository` — is resolved via the go workspace.

```go
// go.mod
module task-api

go 1.25.1

require (
    golang.org/x/crypto v0.36.0
    gorm.io/gorm v1.31.1
)
```

## .env

```ini
DB_URL=task-api.db
MINSTACK_JWT_SECRET=super-secret-key-change-in-production
PORT=8080
```

`DB_URL` is the SQLite file path. `MINSTACK_JWT_SECRET` is the HMAC key used by `auth.Module()` to sign JWTs. For production, use RSA keys instead — see the [auth module docs](/modules/auth).

---

Next: [Users domain](./users)
