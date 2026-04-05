# Authentication API

## Overview

The API uses JWT (JSON Web Token) authentication with Bearer scheme. Users can authenticate via:

- **Email/Password:** Traditional registration and login
- **Google OAuth:** One-click sign-in with Google (frontend-driven flow)

## Token Types

| Token         | Purpose                    | Default Expiry |
|---------------|----------------------------|----------------|
| Access Token  | API request authentication | 30 minutes     |
| Refresh Token | Obtain new access tokens   | 7 days         |

## Authentication Flows

### Email/Password Flow

```text
┌──────────┐     Register/Login      ┌──────────┐
│  Client  │ ──────────────────────► │   API    │
│          │ ◄────────────────────── │          │
└──────────┘   access + refresh      └──────────┘
     │              tokens
     │
     │         Authenticated Request
     │         (Authorization: Bearer <token>)
     ▼
┌──────────┐                         ┌──────────┐
│  Client  │ ──────────────────────► │   API    │
│          │ ◄────────────────────── │          │
└──────────┘       Response          └──────────┘
     │
     │         Token Expired?
     │         Use refresh token
     ▼
┌──────────┐     POST /auth/refresh  ┌──────────┐
│  Client  │ ──────────────────────► │   API    │
│          │ ◄────────────────────── │          │
└──────────┘    New access token     └──────────┘
```

### Google OAuth Flow (Frontend-Driven)

```text
┌──────────┐    Google Sign-In       ┌──────────┐
│  Client  │ ──────────────────────► │  Google  │
│          │ ◄────────────────────── │          │
└──────────┘     ID token (popup)    └──────────┘
     │
     │         POST /auth/google
     │         { id_token: "..." }
     ▼
┌──────────┐                         ┌──────────┐
│  Client  │ ──────────────────────► │   API    │
│          │ ◄────────────────────── │          │
└──────────┘   access + refresh      └──────────┘
                   tokens
```

---

## Endpoints

### Register User

Create a new user account.

```http
POST /api/auth/register
```

**Authentication:** None required

**Request Body:**

| Field       | Type   | Required | Constraints        |
|-------------|--------|----------|--------------------|
| `email`     | string | Yes      | Valid email format |
| `full_name` | string | Yes      | 1-255 characters   |
| `password`  | string | Yes      | 8-100 characters   |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "full_name": "John Doe",
    "password": "securepassword123"
  }'
```

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2026-02-18T10:30:00.000000"
}
```

**Error Responses:**

| Status | Condition                                            |
|--------|------------------------------------------------------|
| 400    | Email already registered                             |
| 422    | Validation error (invalid email, password too short) |

---

### Login

Authenticate and receive access tokens.

```http
POST /api/auth/login
```

**Authentication:** None required

**Request Body:**

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | Yes      |
| `password` | string | Yes      |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securepassword123"
  }'
```

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Responses:**

| Status | Condition                                                        |
| ------ | ---------------------------------------------------------------- |
| 400    | Account uses Google Sign-In (no password set)                    |
| 401    | Invalid email or password                                        |
| 403    | User account is inactive                                         |

---

### Google OAuth

Authenticate or register via Google Sign-In. Supports:

- New user registration with Google
- Existing Google user login
- Linking Google to existing email account

```http
POST /api/auth/google
```

**Authentication:** None required

**Prerequisites:**

- Google OAuth must be enabled (`GOOGLE_OAUTH_ENABLED=true`)
- Valid `GOOGLE_CLIENT_ID` must be configured

**Request Body:**

| Field      | Type   | Required | Description                   |
| ---------- | ------ | -------- | ----------------------------- |
| `id_token` | string | Yes      | Google ID token from frontend |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "is_new_user": true,
  "account_linked": false
}
```

**Response Fields:**

| Field            | Type    | Description                                              |
| ---------------- | ------- | -------------------------------------------------------- |
| `is_new_user`    | boolean | `true` if this created a new account                     |
| `account_linked` | boolean | `true` if Google was linked to existing email account    |

**Error Responses:**

| Status | Condition                                          |
| ------ | -------------------------------------------------- |
| 400    | Google account email is not verified               |
| 401    | Invalid or expired Google token                    |
| 403    | User account is inactive                           |
| 409    | Email already linked to a different Google account |
| 503    | Google Sign-In is not configured                   |

**Account Linking Behavior:**

| Scenario                  | Action                                      |
| ------------------------- | ------------------------------------------- |
| New Google user           | Creates account with `auth_provider=google` |
| Returning Google user     | Returns tokens                              |
| Email user clicks Google  | Links Google to existing account            |
| Conflicting Google link   | Returns 409 error                           |

---

### Refresh Token

Exchange a refresh token for a new access token.

```http
POST /api/auth/refresh
```

**Authentication:** None required

**Request Body:**

| Field           | Type   | Required |
|-----------------|--------|----------|
| `refresh_token` | string | Yes      |

**Example Request:**

```bash
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Responses:**

| Status | Condition                        |
|--------|----------------------------------|
| 401    | Invalid or expired refresh token |

---

### Get Current User

Retrieve the authenticated user's profile.

```http
GET /api/auth/me
```

**Authentication:** Required

**Example Request:**

```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2026-02-18T10:30:00.000000"
}
```

**Error Responses:**

| Status | Condition                |
|--------|--------------------------|
| 401    | Missing or invalid token |

---

## Using Access Tokens

Include the access token in the `Authorization` header for all authenticated requests:

```http
Authorization: Bearer <access_token>
```

**Example:**

```bash
curl http://localhost:8000/api/resumes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Security Implementation

### Password Hashing

- Algorithm: bcrypt (via PassLib)
- Passwords are never stored in plain text

### JWT Configuration

| Setting              | Default    | Environment Variable         |
|----------------------|------------|------------------------------|
| Algorithm            | HS256      | `JWT_ALGORITHM`              |
| Access Token Expiry  | 30 minutes | `ACCESS_TOKEN_EXPIRE_MINUTES`|
| Refresh Token Expiry | 7 days     | `REFRESH_TOKEN_EXPIRE_DAYS`  |
| Secret Key           | (required) | `JWT_SECRET_KEY`             |

### Token Payload

Access tokens contain:

```json
{
  "sub": "<user_id>",
  "exp": 1708259400,
  "type": "access"
}
```

Refresh tokens contain:

```json
{
  "sub": "<user_id>",
  "exp": 1708864200,
  "type": "refresh"
}
```

## Rate Limiting

Authentication endpoints have specific rate limits:

| Endpoint         | Per Minute | Per Hour |
| ---------------- | ---------- | -------- |
| `/auth/login`    | 10         | 50       |
| `/auth/register` | 10         | 50       |
| `/auth/refresh`  | 10         | 50       |
| `/auth/google`   | 10         | 50       |

See [Errors & Rate Limits](errors-rate-limits.md) for details.

## Data Models

### UserCreate

```typescript
{
  email: string;      // Valid email format
  full_name: string;  // 1-255 characters
  password: string;   // 8-100 characters
}
```

### UserLogin

```typescript
{
  email: string;
  password: string;
}
```

### UserResponse

```typescript
{
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;              // ISO 8601 datetime
  headline: string | null;
  about_me: string | null;
  about_me_generated_at: string | null;
  timezone: string | null;
  // OAuth fields
  auth_provider: "email" | "google";
  has_password: boolean;           // Can user use password login?
  google_linked: boolean;          // Is Google account linked?
}
```

### Token

```typescript
{
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}
```

### TokenRefresh

```typescript
{
  refresh_token: string;
}
```

### GoogleAuthRequest

```typescript
{
  id_token: string;  // Google ID token from frontend Sign-In
}
```

### GoogleAuthResponse

```typescript
{
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  is_new_user: boolean;     // True if newly created account
  account_linked: boolean;  // True if Google linked to existing email account
}
```
