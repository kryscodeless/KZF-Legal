# RAG Integration Contract (BE + FE) — v2

This contract defines how Backend (BE), Frontend (FE), and RAG communicate.

RAG is a pure in-process service (`rag/index.js`). 

---

## 1) Ownership scope

### RAG owns

- Document text extraction/parsing (file → text)
- Chunking, embedding, indexing, and vector cleanup
- Retrieval (vector; web leg is a stub), context assembly
- Answer generation and citations
- Returning structured results to BE

### Backend owns

- Auth, validation, chat/message/document IDs
- App MongoDB persistence and status transitions
- Socket rooms/events to FE
- Async orchestration (queue/worker/retry/timeout)
- Passing absolute `filePath` and `mimeType` into RAG after upload

### Frontend owns

- Send HTTP requests
- Render pending/completed/failed states
- Listen to BE socket events only

---

## 2) RAG public API

Exported from `rag/index.js`:

| Function | Purpose |
|----------|---------|
| `init()` | Returns `{ ready: true }`. No socket setup. |
| `ingestDocument({ userId, documentId, filePath, mimeType? })` | Extract text, chunk, embed, index under `user:{userId}`. |
| `submitQuery({ userId, question, documentIds? })` | Embed question, retrieve context, generate answer. |
| `removeDocument({ userId, documentId })` | Delete indexed chunks for one uploaded document. |

Internal test hooks: `__setState`, `__resetState`.

---

## 3) Vector storage

Production indexing uses a dedicated RAG MongoDB URI, not the backend app database.

- Env: `RAG_MONGODB_URI` (required for `ingestDocument`, `submitQuery`, and `removeDocument` at runtime)
- Collection: `vector_chunks` on that connection
- Record fields: `id`, `namespace`, `chunk`, `vector`, `metadata`
- Namespaces:
  - `global` — shared corpus seeded via `npm run rag:ingest`
  - `user:{userId}` — per-user uploads
- Similarity search is in-process cosine scoring over Mongo-backed records (not Atlas Vector Search)

`rag/storage/fileVectorStore.js` exists for unit tests only.

---

## 4) Query flow (chat)

### FE → BE

`POST /api/chat` (or chat-scoped route per API docs)

```json
{
  "query": "What visa options do I have?",
  "chatId": "optional",
  "documentIds": ["optional"]
}
```

### BE immediate response

`202 Accepted`

```json
{
  "success": true,
  "data": {
    "chatId": "mongoId",
    "messageId": "mongoId",
    "status": "pending"
  }
}
```

### BE → RAG

```js
const { submitQuery } = require("../../rag/index");

const result = await submitQuery({
  userId,
  question: query,
  documentIds, // optional; when non-empty, vector search is scoped to those documents
});
```

### Scoped retrieval

- No `documentIds` (or empty): search `global` + `user:{userId}`
- Non-empty `documentIds`: search only `user:{userId}`, filtered to chunks whose `metadata.documentId` or `metadata.sourceId` matches

Vector retrieval is scoped as above. The web leg is a stub (`rag/webRetriever.js`); Tavily web search was cancelled/deferred for this iteration (time-limited scope), so `meta.retrieval.webHits` stays `0`.

### RAG → BE return shape

```json
{
  "answer": "string",
  "citations": [
    {
      "id": 1,
      "title": "Source title",
      "source": "vector",
      "url": "https://example.com",
      "snippet": "supporting text",
      "documentRef": "optional mongo id"
    }
  ],
  "meta": {
    "latencyMs": 1234,
    "model": "string",
    "retrieval": {
      "vectorHits": 4,
      "webHits": 0
    }
  }
}
```

Validated by `rag/schemas/api.js` (`SubmitQueryResponseSchema`).

### BE persistence rules

- On accept: create `Message` with `status: "pending"`
- On success: write `response.answer`, `response.citations`, optional `meta.*`, set `status: "completed"`
- On failure: set `status: "failed"`

---

## 5) Socket contract (BE → FE only)

Target: single event per resource with an explicit status.

Emit to room `user:{userId}`.

### Chat: `chat:updated`

Pending:

```json
{
  "eventVersion": 1,
  "chatId": "mongoId",
  "messageId": "mongoId",
  "status": "pending"
}
```

Completed:

```json
{
  "eventVersion": 1,
  "chatId": "mongoId",
  "messageId": "mongoId",
  "status": "completed",
  "response": {
    "answer": "string",
    "citations": []
  },
  "meta": {
    "latencyMs": 1234,
    "model": "string"
  }
}
```

Failed:

```json
{
  "eventVersion": 1,
  "chatId": "mongoId",
  "messageId": "mongoId",
  "status": "failed",
  "error": {
    "code": "RAG_ERROR",
    "message": "Unable to process query"
  }
}
```

### Document: `document:updated`

Same `eventVersion` pattern with `documentId` and `status` on success.

Deprecated legacy names: `query:result`, `query:error`, `chat:response`, `chat:error`, and any RAG-side Socket.io coupling.

---

## 6) Document ingestion flow

### FE → BE

`POST /api/documents` (multipart upload)

### BE immediate response

`202 Accepted`

```json
{
  "success": true,
  "data": {
    "documentId": "mongoId",
    "chatId": "mongoId",
    "status": "pending"
  }
}
```

### BE → RAG

```js
const { ingestDocument } = require("../../rag/index");

const result = await ingestDocument({
  userId,
  documentId,
  filePath, // absolute path to stored upload on disk
  mimeType, // detected MIME from upload pipeline
});
```

Supported extraction types: `.txt`, `.pdf`, `.doc`, `.docx` (see `rag/documentExtractor.js`).

### RAG → BE return shape

```json
{
  "chunks": 42,
  "meta": {
    "ingestMs": 980
  }
}
```

### BE behavior

- Transition document status: `pending` → `processing` → `ingested` | `failed`
- Emit `document:updated` to the user room

---

## 7) Document deletion flow

When BE deletes an uploaded document, it should also drop indexed vectors.

### BE → RAG

```js
const { removeDocument } = require("../../rag/index");

const result = await removeDocument({
  userId,
  documentId,
});
```

### RAG → BE return shape

```json
{
  "removed": 2
}
```

`removed` is the number of chunk records deleted from `user:{userId}`.

---

## 8) Error contract (RAG → BE)

RAG throws errors with:

```json
{
  "code": "RAG_VALIDATION_ERROR | RAG_UPSTREAM_ERROR | RAG_TIMEOUT | RAG_INTERNAL",
  "message": "human readable",
  "retryable": true
}
```

BE maps these to safe FE errors and DB status updates.

---

## 9) Data consistency rules

- `Message.status`: `pending` | `completed` | `failed` only
- Answer and citations live under `Message.response.answer` and `Message.response.citations`
- No top-level `answer` / `citations` writes on messages
- No mixed legacy socket event names

---

## 10) BE wiring status

- `server/services/chatService.js` — `submitQuery` wired ✅
- `server/services/documentService.js` — `ingestDocument` wired ✅
- `server/services/documentService.js` — `removeDocument` not yet wired; vector chunks are not cleaned up on document deletion ⚠️

Validate the full pipeline end-to-end with `npm run rag:ingest`, `npm run rag:query`, and `tests/rag/`.

---

## 11) Minimum tests

### RAG (in repo)

- `tests/rag/ragService.test.js` — `submitQuery`, `ingestDocument`, `removeDocument`
- `tests/rag/documentExtractor.test.js`
- `tests/rag/storage/*` — Mongo and file vector stores
- Other module tests: chunker, embedder, pipeline, context builder path via service tests

### BE (still required for full stack)

- DB update + socket emit on success/failure
- E2E: `POST /api/chat` → socket `chat:updated`
