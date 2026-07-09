# Error Code Reference

| HTTP | Code | Meaning | Cause | Frontend recommendation |
| --- | --- | --- | --- | --- |
| 400 | BAD_REQUEST | Invalid request or business rule failure | Validation, duplicate UTR, invalid transition, bad payload | Show form-level error and keep user input |
| 401 | UNAUTHORIZED | Authentication failed | Missing, expired, or invalid JWT | Redirect to login or refresh local auth state |
| 403 | FORBIDDEN | Role not allowed | Non-admin accessing admin endpoint | Show permission error |
| 404 | NOT_FOUND | Resource or route missing | Unknown id, slug, order, payment, invoice, shipment, route | Show not-found state |
| 409 | CONFLICT | Duplicate or concurrent business conflict | Duplicate payment/invoice/reservation/ledger event | Refetch latest state and prevent repeat submit |
| 429 | RATE_LIMITED | Too many requests | API/auth limiter exceeded | Back off and show retry message |
| 500 | INTERNAL_ERROR | Unexpected server error | Unhandled runtime or database error | Show generic failure and log correlation context |

Response envelopes are mostly `{ success, data, message }`; legacy auth failures may return `{ status: "error", message }`.
