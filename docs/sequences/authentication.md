# Authentication Sequence

```mermaid
sequenceDiagram
  actor Client
  Client->>AuthRoutes: login/register
  AuthRoutes->>AuthController: validate request
  AuthController->>User: read/write user
  AuthController-->>Client: user + JWT
```
