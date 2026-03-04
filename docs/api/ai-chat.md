# AI Chat API

The AI Chat API provides AI-powered resume section improvements through a conversational interface.

## Base URL

```text
/api/v1/ai
```

## Authentication

All endpoints require authentication via Bearer token.

```text
Authorization: Bearer <access_token>
```

---

## Endpoints

### Improve Section

Improve a specific resume section using AI based on user instructions.

```text
POST /api/v1/ai/improve-section
```

#### Request Body

| Field | Type | Required | Description |
| ------- | ------ | ---------- | ------------- |
| `section_type` | string | Yes | Type of section being improved (see Section Types) |
| `section_content` | string | Yes | Current content (JSON string or plain text) |
| `instruction` | string | Yes | User instruction for improvement |
| `job_context` | string | No | Optional job description to tailor towards |

#### Section Types

- `summary` - Professional summary
- `experience` - Work experience
- `education` - Education history
- `skills` - Skills list
- `projects` - Project descriptions
- `certifications` - Certifications
- `volunteer` - Volunteer experience
- `publications` - Publications
- `awards` - Awards and honors
- `interests` - Personal interests
- `languages` - Language proficiencies
- `references` - Professional references
- `courses` - Courses and training
- `memberships` - Professional memberships

#### Example Request

```bash
curl -X POST http://localhost:8000/api/v1/ai/improve-section \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "section_type": "summary",
    "section_content": "Software developer with 5 years experience.",
    "instruction": "Make this more impactful and professional",
    "job_context": "Senior Software Engineer at a fintech company..."
  }'
```

#### Response

```json
{
  "improved_content": "Results-driven Software Engineer with 5+ years of experience building scalable applications...",
  "changes_summary": "Added quantifiable experience, used stronger action-oriented language, and emphasized impact.",
  "suggestions": [
    "Consider adding specific technologies you've worked with",
    "Include a notable achievement or metric if available"
  ]
}
```

#### Response Fields

| Field | Type | Description |
| ------- | ------ | ------------- |
| `improved_content` | string | The AI-improved section content |
| `changes_summary` | string | Brief explanation of changes made |
| `suggestions` | string[] | Additional improvement suggestions |

---

### Chat

Conversational AI chat for resume improvement with multi-turn support.

```
POST /api/v1/ai/chat
```

#### Request Body

| Field | Type | Required | Description |
| ------- | ------ | ---------- | ------------- |
| `message` | string | Yes | The user's message |
| `section_type` | string | No | Optional section type for context |
| `section_content` | string | No | Optional current section content |
| `chat_history` | ChatMessage[] | No | Previous messages in conversation |
| `job_context` | string | No | Optional job description for context |

#### ChatMessage Object

| Field | Type | Description |
| ----- | ------ | ----------- |
| `role` | string | "user" or "assistant" |
| `content` | string | The message content |

#### Example Request

```bash
curl -X POST http://localhost:8000/api/v1/ai/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How can I improve my experience section for a tech lead role?",
    "section_type": "experience",
    "section_content": "[{\"title\": \"Software Engineer\", \"company\": \"Acme Inc\", ...}]",
    "chat_history": [
      {"role": "user", "content": "I want to improve my resume"},
      {"role": "assistant", "content": "I can help with that! What section would you like to focus on?"}
    ]
  }'
```

#### Chat Response

```json
{
  "message": "For a tech lead role, I recommend highlighting leadership and mentorship experiences. Here are some specific improvements...",
  "improved_content": "[{\"title\": \"Software Engineer\", \"bullets\": [\"Led team of 5 engineers...\"], ...}]",
  "action_type": "improvement"
}
```

#### Chat Response Fields

| Field | Type | Description |
| ------- | ------ | ------------- |
| `message` | string | The assistant's response message |
| `improved_content` | string or null | Improved content if applicable |
| `action_type` | string | Response type: "advice", "improvement", or "question" |

#### Action Types

| Type | Description |
| ------ | ------------- |
| `advice` | General tips and recommendations |
| `improvement` | Response includes concrete content improvements |
| `question` | Clarifying question from the assistant |

---

## Error Responses

### 401 Unauthorized

```json
{
  "detail": "Not authenticated"
}
```

### 500 Internal Server Error

```json
{
  "detail": "AI service error: <error message>"
}
```

or

```json
{
  "detail": "Failed to parse AI response: <error message>"
}
```

---

## Rate Limiting

AI endpoints are subject to stricter rate limits due to the cost of AI operations:

| Limit Type | Requests |
|------------|----------|
| Per Minute | Configured via `RATE_LIMIT_AI_PER_MINUTE` |
| Per Hour | Configured via `RATE_LIMIT_AI_PER_HOUR` |

See [Errors & Rate Limits](errors-rate-limits.md) for details.

---

## Best Practices

1. **Be Specific with Instructions** - Provide clear, actionable instructions for best results
2. **Include Job Context** - When tailoring for a specific role, include the job description
3. **Use Section Targeting** - Always specify the section type when asking for improvements
4. **Preserve Chat History** - Include previous messages for contextual multi-turn conversations
5. **Review Before Applying** - Always review AI suggestions before applying them to your resume
