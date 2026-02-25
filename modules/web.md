# web

Shared HTTP response types for MinStack. Zero dependencies — just two lightweight DTOs for consistent JSON responses.

## Installation

```sh
go get github.com/go-minstack/web
```

## Usage

```go
import "github.com/go-minstack/web"

// Error response
ctx.JSON(http.StatusBadRequest, web.NewErrorDto(err))
// → {"error":"invalid email"}

// Message response
ctx.JSON(http.StatusOK, web.NewMessageDto("user deleted"))
// → {"message":"user deleted"}
```

## API

### `web.ErrorDto`

```go
type ErrorDto struct {
    Error string `json:"error"`
}
```

| Function | Description |
|----------|-------------|
| `web.NewErrorDto(err)` | Wraps an `error` into `ErrorDto` |

### `web.MessageDto`

```go
type MessageDto struct {
    Message string `json:"message"`
}
```

| Function | Description |
|----------|-------------|
| `web.NewMessageDto(msg)` | Wraps a `string` into `MessageDto` |
