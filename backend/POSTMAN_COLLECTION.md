# AI Risk Intellect — API (Postman-style collection)

Use this document to recreate requests in Postman, Insomnia, or Thunder Client.

The Express app mounts the API router at **`/api/v1`**. In Postman, set **`baseUrl`** to the **full API root** (origin + version path), e.g. **`http://localhost:5005/api/v1`**. Request paths below are **relative to that root** (e.g. **`{{baseUrl}}/health`** → `http://localhost:5005/api/v1/health`).

**Import file:** [`AI-Risk-Intellect.postman_collection.json`](./AI-Risk-Intellect.postman_collection.json) — open Postman → **Import** → choose that file.

---

## Collection variables (Postman)

| Variable        | Example value                    | Notes |
| --------------- | -------------------------------- | ----- |
| `baseUrl`       | `http://localhost:5005/api/v1`   | Match `PORT` in `.env` / `env.ts` (default **5005**) plus **`/api/v1`**. |
| `accessToken`   | _(empty, set after login)_       | Paste `accessToken` from login/register response. |
| `userId`        | _(empty or a user UUID)_         | Target user for **PATCH** `{{baseUrl}}/users/:id` (e.g. from **GET** `{{baseUrl}}/users` or **GET** `{{baseUrl}}/auth/me`). |
| `inviteToken`   | _(empty)_                        | Invite or password-reset token from email link (query/body). |

---

## Folder: Health

### GET Health check

- **Method:** `GET`
- **URL:** `{{baseUrl}}/health`
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

Cookies use **`httpOnly`** refresh token **`refresh_token`**, path **`/api/v1`**.  
In Postman: enable **Send cookies** / use the **Cookies** manager under your domain so `{{baseUrl}}/auth/login` responses store the cookie for **`refresh`** and **`logout`**.

---

### POST Register

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/register`
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
- **URL:** `{{baseUrl}}/auth/login`
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

### POST Forgot password

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/forgot-password`
- **Headers:** `Content-Type: application/json`
- **Body:** `{ "email": "user@example.com" }`

---

### POST Reset password

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/reset-password`
- **Headers:** `Content-Type: application/json`
- **Body:** `{ "token": "<from email>", "password": "new-password-min-8" }`

---

### GET Invite set-password (preview)

- **Method:** `GET`
- **URL:** `{{baseUrl}}/auth/invite/set-password?token={{inviteToken}}`

---

### POST Invite set-password (submit)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/invite/set-password`
- **Headers:** `Content-Type: application/json`
- **Body:** `{ "token": "{{inviteToken}}", "password": "new-password-min-8" }`

---

### POST Refresh (new access token)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/refresh`
- **Headers:** _(optional)_ `Content-Type: application/json` (no body required)
- **Body:** none
- **Cookies:** must send stored **`refresh_token`** for path **`/api/v1`** (same site / include credentials from browser; in Postman use cookie jar for your host).

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
- **URL:** `{{baseUrl}}/auth/logout`
- **Headers:** _(optional)_ `Content-Type: application/json`
- **Body:** none
- **Cookies:** send **`refresh_token`** if present (server revokes and clears cookie).

**Example success (204)** — empty body.

---

### GET Me (current user)

- **Method:** `GET`
- **URL:** `{{baseUrl}}/auth/me`
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
    "accountStatus": "completed",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PATCH Me (update profile)

Rotates the access token (same response shape as login). Appends a row to **`user_profile_update_logs`** with **`reason`**, **`updated_by_user_id`**, **`target_user_id`**, and **`changes`** (before/after for each modified field).

- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/auth/me`
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
  - `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "username": "jane_doe",
  "fullName": "Jane Doe",
  "reason": "Updating display name after marriage"
}
```

| Field       | Required | Rules |
| ----------- | -------- | ----- |
| `username`  | Yes      | Same rules as register |
| `fullName`  | No       | Max 255 (trimmed); omit to leave unchanged |
| `reason`    | Yes      | 1–2000 characters, trimmed — stored in **`user_profile_update_logs`** |

**Example success (200)** — `user`, new `accessToken`, `expiresIn`; refresh cookie updated.

---

### POST Me (change password)

- **Method:** `POST`
- **URL:** `{{baseUrl}}/auth/me/change-password`
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
  - `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "currentPassword": "your-secure-password",
  "newPassword": "your-new-secure-password"
}
```

**Example success (200)** — same shape as login (`user`, `accessToken`, `expiresIn`).

---

## Folder: Users

All routes require **`Authorization: Bearer {{accessToken}}`**.

---

### GET Users (list)

- **Method:** `GET`
- **URL:** `{{baseUrl}}/users`
- **Body:** none

**Example success (200)**

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "jane_doe",
      "fullName": "Jane Doe",
      "accountStatus": "completed",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### POST Users invite

- **Method:** `POST`
- **URL:** `{{baseUrl}}/users/invite`
- **Headers:** `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "email": "newuser@example.com"
}
```

**Example success (200)** — `{ "ok": true, "message": "Invitation email sent." }`

---

### PATCH User (admin-style edit)

Updates **`username`**, optional **`fullName`** / **`isActive`**, and appends **`user_profile_update_logs`** with **`reason`**, **`updated_by_user_id`** (caller), **`target_user_id`**, and **`changes`**. You cannot set **`isActive`: `false`** on **your own** user id via this route.

- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/users/{{userId}}`
- **Headers:**
  - `Authorization: Bearer {{accessToken}}`
  - `Content-Type: application/json`
- **Body:** raw JSON

```json
{
  "username": "jane_doe",
  "fullName": "Jane Doe",
  "isActive": true,
  "reason": "HR requested display name and status alignment"
}
```

| Field       | Required | Rules |
| ----------- | -------- | ----- |
| `username`  | Yes      | Same as register |
| `fullName`  | No       | Max 255 trimmed |
| `isActive`  | No       | Boolean; omit to leave unchanged |
| `reason`    | Yes      | 1–2000 characters, trimmed |

**Example success (200)** — `{ "user": { ... } }`

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

Use the checked-in file **[`AI-Risk-Intellect.postman_collection.json`](./AI-Risk-Intellect.postman_collection.json)** (same folder as this doc).  
Alternatively, copy the JSON from that file into Postman **Import** → **Raw text**.

---

## Frontend dev proxy (optional)

If the app runs on Vite with a proxy to the API, browser calls may go through **`http://localhost:5176`** while Postman usually hits the backend directly at **`http://localhost:5005/api/v1/...`**.
