# Errors & Rate Limits

## Overview

This document covers error handling conventions and rate limiting across all API endpoints.

---

# Error Handling

## HTTP Status Codes

| Status | Name | Description |
|--------|------|-------------|
| 200 | OK | Successful GET, PUT, PATCH request |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE (no body returned) |
| 400 | Bad Request | Invalid request parameters or body |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Valid auth but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 413 | Payload Too Large | File upload exceeds size limit |
| 415 | Unsupported Media Type | Invalid file format for upload |
| 422 | Unprocessable Entity | Validation error or processing failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

---

## Error Response Format

All error responses follow a consistent format:

```json
{
  "detail": "Error message describing the problem"
}
```

### Validation Errors (422)

Validation errors include detailed field-level information:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    },
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 8 characters",
      "type": "value_error.any_str.min_length"
    }
  ]
}
```

---

## Common Error Scenarios

### Authentication Errors (401)

```json
// Missing token
{
  "detail": "Not authenticated"
}

// Invalid token
{
  "detail": "Could not validate credentials"
}

// Expired token
{
  "detail": "Token has expired"
}
```

### Authorization Errors (403)

```json
// Accessing another user's resource
{
  "detail": "Not authorized to access this resource"
}

// Account inactive
{
  "detail": "User account is inactive"
}
```

### Resource Errors (404)

```json
// Resource not found
{
  "detail": "Resume not found"
}

// Job not found
{
  "detail": "Job not found"
}
```

### Validation Errors (400/422)

```json
// Email already registered
{
  "detail": "Email already registered"
}

// Invalid file type
{
  "detail": "File type not supported. Accepted: PDF, DOCX"
}

// File too large
{
  "detail": "File size exceeds maximum limit of 10MB"
}
```

---

## Error Handling Best Practices

### Client-Side Handling

```typescript
async function apiRequest(endpoint: string, options: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();

    switch (response.status) {
      case 401:
        // Token expired - try refresh
        await refreshToken();
        return apiRequest(endpoint, options);

      case 403:
        // Permission denied
        throw new PermissionError(error.detail);

      case 404:
        throw new NotFoundError(error.detail);

      case 422:
        // Validation errors
        throw new ValidationError(error.detail);

      case 429:
        // Rate limited - check Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(error.detail, retryAfter);

      default:
        throw new APIError(error.detail, response.status);
    }
  }

  return response.json();
}
```

---

# Rate Limiting

## Overview

The API implements rate limiting using a Redis-based sliding window algorithm. Limits are applied per-user (authenticated) or per-IP (unauthenticated).

## Rate Limit Categories

### Default Limits

Applied to most endpoints:

| Scope | Per Minute | Per Hour |
|-------|-----------|----------|
| Default | 60 | 1000 |

### AI-Powered Endpoints

Applied to computationally intensive AI operations:

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| `POST /api/tailor` | 10 | 100 |
| `POST /api/tailor/quick-match` | 10 | 100 |
| `POST /v1/match` | 10 | 100 |
| `POST /v1/match/analyze` | 10 | 100 |
| `POST /v1/blocks/import` | 10 | 100 |
| `POST /v1/workshops/*/suggest` | 10 | 100 |

### Authentication Endpoints

Applied to prevent brute force attacks:

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| `POST /api/auth/login` | 10 | 50 |
| `POST /api/auth/register` | 10 | 50 |
| `POST /api/auth/refresh` | 10 | 50 |

### Export Endpoints

Applied to resource-intensive file generation:

| Endpoint | Per Minute | Per Hour |
|----------|-----------|----------|
| `GET /api/export/*` | 5 | 30 |
| `POST /v1/workshops/*/export` | 5 | 30 |

---

## Excluded Paths

These endpoints are not rate limited:

- `/health`
- `/`
- `/docs`
- `/redoc`
- `/openapi.json`

---

## Rate Limit Headers

All responses include rate limit information:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

**Example Response Headers:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708257000
```

---

## Rate Limit Exceeded Response

When rate limited, the API returns:

**Status:** `429 Too Many Requests`

**Headers:**

```
Retry-After: 45
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708257000
```

**Body:**

```json
{
  "detail": "Rate limit exceeded. Try again in 45 seconds."
}
```

---

## Handling Rate Limits

### Client-Side Implementation

```typescript
async function apiRequestWithRetry(
  endpoint: string,
  options: RequestInit,
  maxRetries = 3
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`Rate limited. Retrying in ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Best Practices

1. **Check headers proactively** - Monitor `X-RateLimit-Remaining` and slow down before hitting limits

2. **Implement exponential backoff** - When retrying after rate limits:
   ```typescript
   const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
   ```

3. **Cache responses** - Reduce API calls by caching frequently accessed data

4. **Batch operations** - Use bulk endpoints when available instead of multiple single requests

5. **Queue requests** - For background operations, queue requests and process them gradually

---

## Configuration

Rate limits can be configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_ENABLED` | true | Enable/disable rate limiting |
| `RATE_LIMIT_DEFAULT_PER_MINUTE` | 60 | Default requests per minute |
| `RATE_LIMIT_DEFAULT_PER_HOUR` | 1000 | Default requests per hour |
| `RATE_LIMIT_AI_PER_MINUTE` | 10 | AI endpoint requests per minute |
| `RATE_LIMIT_AI_PER_HOUR` | 100 | AI endpoint requests per hour |
| `RATE_LIMIT_AUTH_PER_MINUTE` | 10 | Auth endpoint requests per minute |
| `RATE_LIMIT_AUTH_PER_HOUR` | 50 | Auth endpoint requests per hour |

---

## Identifier Resolution

Rate limits are tracked per unique identifier:

1. **Authenticated requests:** User ID from JWT token
2. **Unauthenticated requests:** Client IP address
3. **Behind proxy:** `X-Forwarded-For` header is respected

---

## Graceful Degradation

If Redis is unavailable, rate limiting degrades gracefully:

- Requests are allowed through (fail-open)
- Warning logged to server logs
- Rate limit headers may be missing or show default values

---

## Related Documentation

- [Authentication](180226_authentication.md) - Auth endpoints and token management
- [Overview](180226_overview.md) - API introduction and quick start
