## Auth API Documentation

### Register User

`POST /api/auth/register`

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/auth/register` |
| **Description** | Register a new user |
| **Auth** | None |
| **Content-Type** | `application/json` |

#### Request

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | ≥8 chars |

```json
{
    "email": "user@example.com",
    "password": "Password1!"
}
```

#### Success Responses

| Status | Body |
|---|---|
| `200 OK` | `{"success": true, "data": {"id": "string", "email": "string", "role": "user", "createdAt": "string", "updatedAt": "string"}}` |

```json
{
    "success": true,
    "data": {
        "id": "69fd40c5b62530ecf1f3608b",
        "email": "user@example.com",
        "role": "user",
        "createdAt": "2026-05-08T01:47:49.450Z",
        "updatedAt": "2026-05-08T01:47:49.450Z"
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Zod validation failed |
| `409` | `USER_ALREADY_EXISTS` | Email already registered |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Login User

`POST /api/auth/login`

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/auth/login` |
| **Description** | Authenticate user and return JWT |
| **Auth** | None |
| **Content-Type** | `application/json` |

#### Request

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Required (non-empty) |

```json
{
    "email": "user@example.com",
    "password": "Password1!"
}
```

#### Success Responses

| Status | Body |
|---|---|
| `200 OK` | `{"success": true, "data": {"token": "jwt_token", "expiresIn": "string", "user": ...}}` |

```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZmQyOGQ2ZjEwMWE1OWM3OWU0OGQ4NyIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzc4MjA0NzU5LCJleHAiOjE3Nzg4MDk1NTl9.4LzNp_7F8p5S2Y71sQeVllcxT7k-pns-GYe1TVpJqeA",
        "expiresIn": "7d",
        "user": {
            "id": "69fd28d6f101a59c79e48d87",
            "email": "user@example.com",
            "role": "user",
            "createdAt": "2026-05-08T00:05:42.244Z",
            "updatedAt": "2026-05-08T00:05:42.244Z"
        }
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Zod validation failed |
| `401` | `AUTH_INVALID_CREDENTIALS` | Invalid email or password |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Logout User

`POST /api/auth/logout`

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/auth/logout` |
| **Description** | Logout user (client discards JWT) |
| **Auth** | Required (JWT) |
| **Content-Type** | `application/json` |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

No body required.

#### Success Responses

| Status | Body |
|---|---|
| `200 OK` | `{"success": true, "data": {"message": "Successfully logged out"}}` |

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `401` | `AUTH_INVALID_TOKEN` | Unauthorized: Invalid or missing token |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Get Current User

`GET /api/auth/getMe`

| Field | Value |
|---|---|
| **Endpoint** | `POST /api/auth/getMe` |
| **Description** | Get authenticated user's profile |
| **Auth** | None |
| **Content-Type** | `application/json` |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

No body required.

#### Success Responses

| Status | Body |
|---|---|
| `200 OK` | `{"success": true, "data": {"id": "string", "email": "user@example.com"}}` |

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `401` | `AUTH_INVALID_TOKEN` | Unauthorized: Invalid or missing token |
| `404` | `NOT_FOUND` | User not found |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |
---

## Chat API Documentation

### Create Chat

`POST /api/chat/create`

| Field | Value |
|---|---|
| **Description** | Create a new chat for the authenticated user |
| **Auth** | Required (JWT) |
| **Content-Type** | `application/json` |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Field | Type | Required | Rules |
|---|---|---|---|
| `title` | string | No | Max 100 characters. Defaults to `"New Chat"` if omitted |

```json
{
    "title": "Skilled Worker Visa Query"
}
```

#### Success Response

| Status | Body |
|---|---|
| `201 Created` | `{"success": true, "data": {"chatId": "string"}}` |

```json
{
    "success": true,
    "data": {
        "chatId": "6819a1f2e4b0c3d5f8a9b123"
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Title exceeds 100 characters |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Submit Query

`POST /api/chat/:chatId`

| Field | Value |
|---|---|
| **Description** | Submit a natural language legal query to an existing chat. Returns immediately with a pending message ID. The RAG pipeline processes the query asynchronously and delivers the response via Socket.io |
| **Auth** | Required (JWT) |
| **Content-Type** | `application/json` |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `chatId` | string | Yes | Valid MongoDB ObjectId |

| Field | Type | Required | Rules |
|---|---|---|---|
| `query` | string | Yes | Min 1 character, max 2000 characters |
| `documentIds` | string[] | No | Array of valid MongoDB ObjectIds. Defaults to `[]` |

```json
{
    "query": "Do I need a skills assessment from Engineers Australia to apply for Australian permanent residency?",
    "documentIds": ["6819a1f2e4b0c3d5f8a9b124"]
}
```

#### Success Response

`202 Accepted` — The query has been received and is being processed. The actual answer is delivered asynchronously via Socket.io.

```json
{
    "success": true,
    "data": {
        "messageId": "6819a1f2e4b0c3d5f8a9b125",
        "status": "pending"
    }
}
```

#### Socket.io Events

Once the RAG pipeline completes, one of the following events is emitted to the authenticated user's socket room `user:<userId>`:

**On success — `chat:update`**
```json
{
    "messageId": "6819a1f2e4b0c3d5f8a9b125",
    "status": "completed",
    "response": {
        "answer": "Yes. For most engineering occupations...",
        "citations": [
            {
                "id": 1,
                "title": "Skills assessment for migration — Engineers Australia",
                "source": "web",
                "url": "https://www.engineersaustralia.org.au/skills-assessment",
                "snippet": "A skills assessment from Engineers Australia is required..."
            }
        ]
    }
}
```

**On failure — `chat:update`**
```json
{
    "messageId": "6819a1f2e4b0c3d5f8a9b125",
    "status": "failed",
    "error": "An error occurred while processing your query. Please try again later."
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Query missing, exceeds 2000 chars, or invalid documentId format |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | chatId does not exist or does not belong to the authenticated user |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### List Chats

`GET /api/chat/`

| Field | Value |
|---|---|
| **Description** | Retrieve a paginated list of all chats belonging to the authenticated user, sorted by most recent activity |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Query Param | Type | Required | Rules |
|---|---|---|---|
| `page` | integer | No | Min `1`. Defaults to `1` |
| `limit` | integer | No | Min `1`, max `50`. Defaults to `10` |

#### Success Response

```json
{
    "success": true,
    "data": {
        "chats": [
            {
                "_id": "6819a1f2e4b0c3d5f8a9b123",
                "title": "Skilled Worker Visa Query",
                "lastMessageAt": "2026-05-07T01:33:00.000Z",
                "createdAt": "2026-05-06T10:00:00.000Z",
                "updatedAt": "2026-05-07T01:33:00.000Z"
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 10,
            "total": 42,
            "totalPages": 5
        }
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `page` or `limit` is not a positive integer, or `limit` exceeds 50 |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Get Chat

`GET /api/chat/:chatId`

| Field | Value |
|---|---|
| **Description** | Retrieve a specific chat by ID including all of its messages, sorted by creation time. Only returns chats belonging to the authenticated user |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `chatId` | string | Yes | Valid MongoDB ObjectId |

#### Success Response

```json
{
    "success": true,
    "data": {
        "chat": {
            "_id": "6819a1f2e4b0c3d5f8a9b123",
            "title": "Skilled Worker Visa Query",
            "lastMessageAt": "2026-05-07T01:33:00.000Z",
            "createdAt": "2026-05-06T10:00:00.000Z",
            "updatedAt": "2026-05-07T01:33:00.000Z",
            "messages": [
                {
                    "_id": "6819a1f2e4b0c3d5f8a9b125",
                    "query": "Do I need a skills assessment?",
                    "response": {
                        "answer": "Yes. For most engineering occupations...",
                        "citations": []
                    },
                    "status": "completed",
                    "createdAt": "2026-05-07T01:33:00.000Z"
                }
            ]
        }
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `chatId` is not a valid MongoDB ObjectId |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | Chat does not exist or does not belong to the authenticated user |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Delete Chat

`DELETE /api/chat/:chatId`

| Field | Value |
|---|---|
| **Description** | Permanently delete a chat and all of its associated messages. Only the owning user can delete their own chats. Message deletion is handled automatically by the Chat model's post middleware |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `chatId` | string | Yes | Valid MongoDB ObjectId |

#### Success Response

```json
{
    "success": true
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `chatId` is not a valid MongoDB ObjectId |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | Chat does not exist or does not belong to the authenticated user |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Chat Status Reference

The `status` field on a message reflects where it is in the RAG processing pipeline:

| Status | Description |
|---|---|
| `pending` | Message has been received and the query is queued for processing |
| `completed` | RAG pipeline processed the query successfully and a response with citations is available |
| `failed` | Processing failed — the query could not be answered |

---

## Document API Documentation

### Upload Document

`POST /api/documents/upload/:chatId`

| Field | Value |
|---|---|
| **Description** | Upload a document to a specific chat. Returns immediately with a pending document ID. Text extraction and RAG ingestion are processed asynchronously and the result is delivered via Socket.io |
| **Auth** | Required (JWT) |
| **Content-Type** | `multipart/form-data` |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `chatId` | string | Yes | Valid MongoDB ObjectId |

| Field | Type | Required | Rules |
|---|---|---|---|
| `document` | file | Yes | Max 10MB. Accepted types: `.pdf`, `.doc`, `.docx`, `.txt` |

#### Success Response

`202 Accepted` — The document has been received and is being processed. The ingestion result is delivered asynchronously via Socket.io.

```json
{
    "success": true,
    "data": {
        "documentId": "6819a1f2e4b0c3d5f8a9b124",
        "status": "pending"
    }
}
```

#### Socket.io Events

Once the RAG pipeline completes, one of the following events is emitted to the authenticated user's socket room `user:<userId>`:

**On success — `document:update`**
```json
{
    "documentId": "6819a1f2e4b0c3d5f8a9b124",
    "status": "ingested",
    "extractedSummary": "This document outlines the requirements for engineering occupations..."
}
```

**On failure — `document:update`**
```json
{
    "documentId": "6819a1f2e4b0c3d5f8a9b124",
    "status": "failed",
    "error": "An error occurred while processing the document. Please try again later."
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `chatId` is not a valid MongoDB ObjectId |
| `400` | `LIMIT_FILE_SIZE` | File exceeds the 10MB size limit |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | `chatId` does not exist |
| `409` | `DOCUMENT_ALREADY_EXISTS` | An identical document has already been uploaded to this chat |
| `415` | `UNSUPPORTED_FILE_TYPE` | File MIME type or extension is not permitted |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### List All Documents

`GET /api/documents/`

| Field | Value |
|---|---|
| **Description** | Retrieve a paginated list of all documents belonging to the authenticated user across all chats, sorted by most recently uploaded. Sensitive fields such as `storageUrl`, `extractedSummary`, and `checksum` are excluded from the response |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Query Param | Type | Required | Rules |
|---|---|---|---|
| `page` | integer | No | Min `1`. Defaults to `1` |
| `limit` | integer | No | Min `1`, max `50`. Defaults to `10` |

#### Success Response

```json
{
    "success": true,
    "data": {
        "documents": [
            {
                "_id": "6819a1f2e4b0c3d5f8a9b124",
                "user": "6819a1f2e4b0c3d5f8a9b120",
                "chat": "6819a1f2e4b0c3d5f8a9b123",
                "filename": "passport_scan.pdf",
                "mimeType": "application/pdf",
                "size": 204800,
                "status": "ingested",
                "createdAt": "2026-05-07T01:33:00.000Z",
                "updatedAt": "2026-05-07T01:33:00.000Z"
            }
        ]
    }
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `page` or `limit` is not a positive integer, or `limit` exceeds `50` |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### List Documents By Chat

`GET /api/documents/chat/:chatId`

| Field | Value |
|---|---|
| **Description** | Retrieve all documents belonging to the authenticated user within a specific chat, sorted by most recently uploaded. Sensitive fields such as `storageUrl`, `extractedSummary`, and `checksum` are excluded from the response |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `chatId` | string | Yes | Valid MongoDB ObjectId |

#### Success Response

```json
{
    "success": true,
    "data": {
        "documents": [
            {
                "_id": "6819a1f2e4b0c3d5f8a9b124",
                "user": "6819a1f2e4b0c3d5f8a9b120",
                "chat": "6819a1f2e4b0c3d5f8a9b123",
                "filename": "passport_scan.pdf",
                "mimeType": "application/pdf",
                "size": 204800,
                "status": "ingested",
                "createdAt": "2026-05-07T01:33:00.000Z",
                "updatedAt": "2026-05-07T01:33:00.000Z"
            }
        ]
    }
}
```

> **Note:** If the `chatId` exists but has no documents, an empty array is returned. A `404` is not thrown for an empty chat.

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `chatId` is not a valid MongoDB ObjectId |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Delete Document

`DELETE /api/documents/:documentId`

| Field | Value |
|---|---|
| **Description** | Permanently delete a document by ID. Removes the record from the database, the file from disk, and will trigger cleanup of associated vector embeddings in the RAG pipeline when implemented. Only the owning user can delete their own documents |
| **Auth** | Required (JWT) |

#### Request

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |

| Param | Type | Required | Rules |
|---|---|---|---|
| `documentId` | string | Yes | Valid MongoDB ObjectId |

#### Success Response

```json
{
    "success": true,
    "message": "Document deleted successfully"
}
```

#### Error Responses

| Status | Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `documentId` is not a valid MongoDB ObjectId |
| `401` | `AUTH_INVALID_TOKEN` | Missing or invalid JWT |
| `404` | `NOT_FOUND` | Document does not exist or does not belong to the authenticated user |
| `500` | `INTERNAL_SERVER_ERROR` | Server error |

---

### Document Status Reference

The `status` field on a document reflects where it is in the ingestion pipeline:

| Status | Description |
|---|---|
| `pending` | Document has been uploaded and is queued for processing |
| `ingested` | Text extraction and RAG indexing completed successfully |
| `failed` | Processing failed — see `errorMessage` field for detail |