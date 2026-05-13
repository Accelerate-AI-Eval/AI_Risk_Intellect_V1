# AI Risk Intellect — API (Postman-style collection)

Use this document to recreate requests in Postman, Insomnia, or Thunder Client.  
Base path for all routes below: **`/api`**.

---

## Collection variables (Postman)

| Variable   | Example value              | Notes                                      |
| ---------- | -------------------------- | ------------------------------------------ |
| `baseUrl`  | `http://localhost:5005`    | Match `PORT` in `.env` / `env.ts` (default 5005). |
| `accessToken` | _(empty, set after login)_ | Paste `accessToken` from login/register response. |

---

## Folder: Health

### GET Health check

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/health`
- **Headers:** _(none required)_
- **Body:** none

**Example success (200)**

```json
{
  "status": "ok",
  "uptime": 12.345
}
```

---

## Folder: Auth

Cookies use **`httpOnly`** refresh token **`refresh_token`**, path **`/api/auth`**.  
In Postman: enable **Send cookies** / use the **Cookies** manager under your domain so `/api/auth/login` responses store the cookie for **`refresh`** and **`logout`**.

---

### POST Register

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/register`
- **Headers:**
  - `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "email": "user@example.com",
  "username": "jane_doe",
  "password": "your-secure-password",
  "fullName": "Jane Doe"
}
```

| Field       | Required | Rules |
| ----------- | -------- | ----- |
| `email`     | Yes      | Valid email, max 255, lowercased |
| `username`  | Yes      | 3–64 chars, `[a-zA-Z0-9_.-]` |
| `password`  | Yes      | 8–128 chars |
| `fullName`  | No       | Max 255 |

**Example success (201)**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "jane_doe",
    "fullName": "Jane Doe",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "accessToken": "jwt-access-token",
  "expiresIn": "15m"
}
```

Sets **`refresh_token`** cookie (not visible to JS).

---

### POST Login

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/login`
- **Headers:**
  - `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "emailOrUsername": "jane_doe",
  "password": "your-secure-password"
}
```

| Field             | Required |
| ----------------- | -------- |
| `emailOrUsername` | Yes (email or username, max 255) |
| `password`        | Yes (max 128) |

**Example success (200)** — same shape as register: `user`, `accessToken`, `expiresIn`.  
Sets **`refresh_token`** cookie.

---

### POST Refresh (new access token)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/refresh`
- **Headers:** _(optional)_ `Content-Type: application/json` (no body required)
- **Body:** none
- **Cookies:** must send stored **`refresh_token`** for path **`/api/auth`** (same site / include credentials from browser; in Postman use cookie jar for `baseUrl`).

**Example success (200)**

```json
{
  "user": { "...": "same as login user object" },
  "accessToken": "new-jwt-access-token",
  "expiresIn": "15m"
}
```

Rotates refresh cookie.

---

### POST Logout

- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/auth/logout`
- **Headers:** _(optional)_ `Content-Type: application/json`
- **Body:** none
- **Cookies:** send **`refresh_token`** if present (server revokes and clears cookie).

**Example success (204)** — empty body.

---

### GET Me (current user)

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/auth/me`
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
- **Body:** none

**Example success (200)**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "jane_doe",
    "fullName": "Jane Doe",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

## Error responses (common)

Errors use this JSON shape:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Human-readable message",
    "details": {}
  }
}
```

- **400** — validation (`details` often Zod issues).  
- **401** — missing/invalid tokens or credentials.  
- **404** — unknown route.  
- **409** — conflict (e.g. duplicate email/username on register).  
- **500** — server error (`details` may include message in development).

---

## Postman import (Collection v2.1 JSON)

Copy the block below into a file named `AI-Risk-Intellect.postman_collection.json`, then **Import** that file in Postman.

```json
{
  "info": {
    "name": "AI Risk Intellect API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:5005" },
    { "key": "accessToken", "value": "" }
  ],
  "item": [
    {
      "name": "Health",
      "item": [
        {
          "name": "GET /api/health",
          "request": {
            "method": "GET",
            "header": [],
            "url": "{{baseUrl}}/api/health"
          }
        }
      ]
    },
    {
      "name": "Auth",
      "item": [
        {
          "name": "POST /api/auth/register",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"user@example.com\",\n  \"username\": \"jane_doe\",\n  \"password\": \"your-secure-password\",\n  \"fullName\": \"Jane Doe\"\n}"
            },
            "url": "{{baseUrl}}/api/auth/register"
          }
        },
        {
          "name": "POST /api/auth/login",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"emailOrUsername\": \"jane_doe\",\n  \"password\": \"your-secure-password\"\n}"
            },
            "url": "{{baseUrl}}/api/auth/login"
          }
        },
        {
          "name": "POST /api/auth/refresh",
          "request": {
            "method": "POST",
            "header": [],
            "url": "{{baseUrl}}/api/auth/refresh"
          }
        },
        {
          "name": "POST /api/auth/logout",
          "request": {
            "method": "POST",
            "header": [],
            "url": "{{baseUrl}}/api/auth/logout"
          }
        },
        {
          "name": "GET /api/auth/me",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{accessToken}}"
              }
            ],
            "url": "{{baseUrl}}/api/auth/me"
          }
        }
      ]
    }
  ]
}
```

---

## Frontend dev proxy (optional)

If the app runs on Vite with a proxy to the API, browser calls may use **`http://localhost:5176/api/...`** while Postman usually hits the backend directly at **`http://localhost:5005/api/...`**.
