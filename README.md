# KFZ-Legal
KFZ Legal — an AI powered legal guidance platform
helping immigrants navigate the Australian immigration system.

## Expected Folder Structure

This is the current baseline structure and will evolve over time as features are added.

```text
public/
  index.html
  css/
    styles.css
  js/
    app.js
    chat.js
    citations.js
    upload.js
    socket.js

server/
  app.js
  server.js
  API_Documentation.md
  Architecture_Diagrams.md
  config/
    env.js
    database.js
    passport.js
  models/
    User.js
    Chat.js
    Message.js
    Document.js
  controllers/
    authController.js
    chatController.js
    documentController.js
  services/
    authService.js
    chatService.js
    documentService.js
  routes/
    index.js
    adminRoutes.js
    authRoutes.js
    chatRoutes.js
    documentRoutes.js
    healthRoutes.js
  middleware/
    authenticateSocket.js
    validateRequest.js
    errorHandler.js
    notFound.js
    requireAuth.js
    requireAdmin.js
    upload.js
  validators/
    authValidator.js
    chatValidator.js
    docValidator.js
  utils/
    logger.js
    seed.js

rag/
  corpus/
    500 Student Visa Application Checklist 06.10.2020.pdf
    checklist_600_tourist_stream_new_delhi_post_version_140915.pdf
    Explore-Australian-Visa-Options.pdf
    Subclass_500_Student_visa.pdf
  data/
  schemas/
    api.js
    events.js
  scripts/
    ingest.js
    query.js
  storage/
    fileVectorStore.js
    index.js
    mongoVectorStore.js
    vectorSearch.js
  chunker.js
  contextBuilder.js
  documentExtractor.js
  embedder.js
  generator.js
  index.js
  INTEGRATION.md
  pipeline.js
  webRetriever.js

tests/
  e2e/
    playwright.config.js
    auth-flow.spec.js
    upload-ask.spec.js
  public/
  rag/
    chunkter.test.js
    documentExtractor.test.js
    embedder.test.js
    mongoVectorStore.test.js
    pipeline.test.js
    ragService.test.js
    vectorStore.test.js
    fixtures/
      student-visa.pdf
  server/
    auth.test.js
    health.test.js
    middleware.test.js
    notFound.test.js
    chat.test.js
    document.test.js
    setup.js
    helpers/
      mockAuth.js
      fakeSocket.js
    fixtures/
      generate.js
```

## Tech Stack

### Core Runtime & Framework
- **Runtime:** Node.js
- **Framework:** Express.js
- **Security:** Helmet.js
- **CORS:** cors
- **Logging:** Pino + pino-pretty
- **Environment:** dotenv

### Authentication & Security
- **Auth Framework:** Passport.js
- **Auth Strategy:** passport-local
- **JWT:** passport-jwt + jsonwebtoken
- **Password Hashing:** bcryptjs

### Database & ODM
- **Database:** MongoDB
- **ODM:** Mongoose

### AI & RAG Pipeline
- **LLM SDK:** Anthropic AI SDK
- **Embeddings / Completions:** OpenAI

### Document Parsing
- **PDF Processing:** pdf-lib + pdf-parse
- **Word Documents:** mammoth + word-extractor
- **MIME Type Detection:** file-type
- **File Uploads:** Multer

### Real-Time
- **WebSockets:** Socket.io

### Validation
- **Schema Validation:** Zod

### HTTP & Middleware
- **Request Logging:** morgan

### Developer Tooling
- **Dev Server:** nodemon
- **Formatting:** Prettier

### Testing
- **Test Runner:** Mocha
- **Assertion Library:** Chai
- **Mocking:** Sinon
- **HTTP Testing:** Supertest
- **E2E / Integration:** Playwright


## Getting Started with contributing

### Prerequisites

- Node.js v20 or higher
- npm v10 or higher
- MongoDB instance

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kryscodeless/KZF-Legal.git
   cd KFZ-Legal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the .env.example to .env and configure the variables

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Verify the server is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | Yes | `development` \| `production` \| `test` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `RAG_MONGODB_URI` | Yes | MongoDB vector database connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `7d`) |
| `ALLOWED_ORIGINS` | Yes | Allowed origins for CORS |
| `ANTHROPIC_API_KEY` | Yes | API key for the Anthropic LLM |
| `OPENAI_API_KEY` | Yes | API key for OpenAI embeddings |
| `EMBED_MODEL` | Yes | Deployment name of the embedding model |
| `LLM_MODEL` | Yes | Deployment name of the LLM |

### Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start the production server (`server/server.js`) |
| `npm run dev` | Start the dev server with nodemon hot-reload |
| `npm run seed` | Seed the database with sample data |
| `npm run seed:clear` | Clear all seeded data |
| `npm run test:server` | Run the Mocha server-side test suite (unit + integration) |
| `npm run test:rag` | Run the Mocha RAG pipeline test suite |
| `npm run test:e2e` | Run the Playwright end-to-end tests |
| `npm run rag:ingest` | Ingest the corpus PDFs into the vector store |
| `npm run rag:query` | Run an ad-hoc RAG query from the CLI |

## Frontend

The frontend is a vanilla HTML/CSS/JavaScript application served from the `public/` folder.

### Pages

| Page | File | Description |
|------|------|-------------|
| Login / Register | `index.html` | Authentication screens for signing in or creating an account. Connects to `/api/login-page` and `/api/register-page`. |
| Home | `index.html` | Dashboard shown after login. Displays a greeting, quick ask box, recent conversations, and shortcuts to other pages. |
| Chat | `index.html` | Main AI conversation interface. Messages are sent to the backend via Socket.io and responses are rendered with citation badges. |
| Upload | `index.html` | Drag and drop document upload page. Accepts PDF, DOC, and DOCX files up to 10MB. Connects to `/api/upload-page`. |
| History | `index.html` | Lists all past conversation sessions with search and date filtering. Supports resume and delete actions. |

### Frontend Files 

| File | Description |
|------|-------------|
| `public/css/styles.css` | All styling design tokens, layout, components. |
| `public/js/chat.js` | Handles message rendering, typing indicator, suggestion chips, and session title updates. |
| `public/js/socket.js` | Manages the Socket.io connection. Authenticates with the session token from login and listens for `chat:response` events. |
| `public/js/upload.js` | Handles drag and drop, client-side file validation (type, size, duplicates), and upload progress UI. |
| `public/js/app.js` | Handles main functionality of the app flow states. |

### Socket Events

All events are emitted to the room `user:<userId>` after JWT authentication
of the socket connection.

| Event | Direction | Payload (success) | Payload (failure) |
|---|---|---|---|
| `chat:update` | Server → Client | `{ messageId, status: "completed", response: { answer, citations[] } }` | `{ messageId, status: "failed", error }` |
| `document:update` | Server → Client | `{ documentId, status: "ingested", extractedSummary }` | `{ documentId, status: "failed", error }` |

## Architecture Overview

KFZ-Legal is a **JWT-authenticated, RAG-powered legal chat backend** with
asynchronous document ingestion and Socket.io for real-time updates.

```mermaid
graph TB
    User([👤 End User])
    System[/"Legal RAG Chat System"/]
    LLM([🤖 Anthropic LLM])
    VectorDB([🔍 Vector Store])

    User -->|HTTPS REST + WebSocket| System
    System -->|Embeds & Queries| VectorDB
    System -->|Generates Answers| LLM
```

For the full set of diagrams (container, component, sequence, ERD), see
[`server/Architecture_Diagrams.md`](./server/Architecture_Diagrams.md).

## Data Model

The system has four core entities:

- **User** — authenticated account (email + bcrypt password hash, role)
- **Chat** — conversation owned by a user
- **Message** — query + RAG-generated response within a chat, with
  embedded citations (vector or web sourced)
- **Document** — uploaded file scoped to a chat, with extracted text and
  embeddings stored in the vector store

Cascading delete: removing a `Chat` automatically removes its `Message`s
via a Mongoose post-hook.

Full ERD: [`server/Architecture_Diagrams.md`](./server/Architecture_Diagrams.md#6-data-model--entity-relationship)

## Async API Contract

Two endpoints follow an **async-via-Socket.io** pattern:

- `POST /api/chat/:chatId` — submits a query
- `POST /api/documents/upload/:chatId` — uploads a document

Both return **`202 Accepted`** immediately with a `pending` status. The
client must subscribe to the Socket.io room `user:<userId>` to receive
the actual result via `chat:update` or `document:update` events.

## API Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/health` | Health Check | ❌ |
| POST | `/api/auth/register` | Register a new user | ❌ |
| POST | `/api/auth/login` | Login, returns JWT (7d) | ❌ |
| POST | `/api/auth/logout` | Logout (client-side discard) | ✅ |
| GET | `/api/auth/getMe` | Get current user profile | ✅ |
| POST | `/api/chat/create` | Create a new chat | ✅ |
| POST | `/api/chat/:chatId` | Submit query (async) | ✅ |
| GET | `/api/chat/` | List user's chats (paginated) | ✅ |
| GET | `/api/chat/:chatId` | Get chat with messages | ✅ |
| DELETE | `/api/chat/:chatId` | Delete chat + cascade messages | ✅ |
| POST | `/api/documents/upload/:chatId` | Upload document (async) | ✅ |
| GET | `/api/documents/` | List all user's documents | ✅ |
| GET | `/api/documents/chat/:chatId` | List documents in a chat | ✅ |
| DELETE | `/api/documents/:documentId` | Delete document | ✅ |

Full specs: [`server/API_Documentation.md`](./server/API_Documentation.md)