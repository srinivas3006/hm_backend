# Admin Sequence

```mermaid
sequenceDiagram
  Admin->>AdminRoutes: protected request
  AdminRoutes->>AuthMiddleware: JWT
  AdminRoutes->>RoleMiddleware: admin role
  AdminRoutes->>AdminController: orchestrate
  AdminController->>Service: business action
  Service-->>AdminController: result
```
