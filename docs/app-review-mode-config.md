# App Review Mode Runtime Config

## Purpose
Move app-review-mode control from frontend build-time variables to backend runtime configuration.

## Endpoint
- `GET /api/app-config/review-mode`

## Environment Variables (backend)
- `APP_REVIEW_MODE` (or `HUSHH_APP_REVIEW_MODE`)  
  Truthy values: `1`, `true`, `yes`, `on`
- `REVIEWER_EMAIL`
- `REVIEWER_PASSWORD`

## Response
- When disabled:
```json
{
  "enabled": false
}
```

- When enabled:
```json
{
  "enabled": true,
  "reviewer_email": "reviewer@example.com",
  "reviewer_password": "••••••••"
}
```

## Notes
- This endpoint is included via the shared health router.
- Frontend web requests can proxy through Next API routes.
- Native iOS/Android clients can call backend directly.
