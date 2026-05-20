# Backend Architecture Diagrams

---

## 1. System Context Diagram (High-Level)

```mermaid
graph TB
    User([👤 End User<br/>Web/Mobile Client])
    System[/"Legal RAG Chat System"/]
    LLM([🤖 LLM Provider<br/>Anthropic])
    VectorDB([🔍 Vector Database<br/>RAG Embeddings])

    User -->|HTTPS REST + WebSocket| System
    System -->|Embeds & Queries| VectorDB
    System -->|Generates Answers| LLM

    style System fill:#1168bd,stroke:#0b4884,color:#fff
    style User fill:#08427b,stroke:#052e56,color:#fff
```

---

## 2. Container Diagram (Service Boundaries)

```mermaid
graph TB
    Client[🖥️ Client App<br/>Browser/Mobile]

    subgraph "Backend System"
        API[🚪 API Gateway / Express App<br/>REST endpoints + JWT middleware]
        Socket[🔌 Socket.io Server<br/>Room: user:userId]
        Worker[⚙️ Async RAG Worker<br/>Query + Document Pipeline]
        Storage[(💾 File Storage<br/>Uploaded Documents)]
        Mongo[(🍃 Database<br/>Users, Chats, Messages, Documents)]
        Vector[(🧠 Vector Store<br/>Document Embeddings)]
    end

    LLM([🤖 LLM API])

    Client -->|"REST /api/auth/<br/>/api/chat/<br/>/api/documents/"| API
    Client <-->|WebSocket events| Socket
    API -->|Read/Write| Mongo
    API -->|Persist files| Storage
    API -->|Submit jobs| Worker
    Worker -->|Extract + Embed| Vector
    Worker -->|Generate answer| LLM
    Worker -->|Return result<br/>+ status update| API
    API -->|Update message/doc status| Mongo
    API -->|Emit chat:update<br/>document:update| Socket

    style API fill:#1168bd,color:#fff
    style Worker fill:#1168bd,color:#fff
    style Socket fill:#1168bd,color:#fff
```

---

## 3. Component Diagram — API Layer

```mermaid
graph LR
    subgraph "Express Application"
        direction TB

        subgraph Middleware
            JWT[JWT Auth<br/>Middleware]
            ErrorH[Error Handler]
            Multer[Multer Upload<br/>10MB limit]
            Validator[Zod Validator]
        end

        subgraph "Auth Module"
            AuthCtrl[Auth Controller]
            AuthSvc[Auth Service<br/>bcrypt + JWT signing]
        end

        subgraph "Chat Module"
            ChatCtrl[Chat Controller]
            ChatSvc[Chat Service]
            ChatModel[Chat Model<br/>+ post-delete hook]
        end

        subgraph "Document Module"
            DocCtrl[Document Controller]
            DocSvc[Document Service<br/>checksum dedupe]
            DocModel[Document Model]
        end

        subgraph "Async Layer"
            RAGPipe[RAG Pipeline]
        end
    end

    JWT --> AuthCtrl & ChatCtrl & DocCtrl
    Validator --> AuthCtrl & ChatCtrl & DocCtrl
    Multer --> DocCtrl

    AuthCtrl --> AuthSvc
    ChatCtrl --> ChatSvc --> ChatModel
    DocCtrl --> DocSvc --> DocModel

    ChatSvc -.submit query.-> RAGPipe
    DocSvc -.submit document for ingestion.-> RAGPipe

    style RAGPipe fill:#f4a261
```

---

## 4. Sequence Diagram — Submit Query Flow

``` mermaid
sequenceDiagram
    actor U as User
    participant C as Client
    participant API as Express API
    participant DB as MongoDB
    participant W as RAG Worker
    participant V as Vector Store
    participant L as LLM
    participant S as Socket.io

    U->>C: Type query
    C->>API: POST /api/chat/:chatId
    API->>API: Verify JWT, validate chat
    API->>DB: Insert message (status: pending)
    API->>W: Submit RAG job
    API-->>C: 202 Accepted { messageId, status: "pending" }

    W->>V: Retrieve relevant chunks
    W->>L: Generate answer w/ context
    L-->>W: Answer + citations
    W-->>API: Return result (success or failure)
    API->>DB: Update message<br/>(status: completed/failed)
    API->>S: Emit chat:update to user:userId
    S-->>C: { messageId, status, response }
    C-->>U: Render answer
```

---

## 5. Sequence Diagram — Document Upload Flow

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client
    participant API as Express API
    participant FS as File Storage
    participant DB as MongoDB
    participant Q as Job Queue
    participant W as RAG Worker
    participant V as Vector Store
    participant S as Socket.io

    U->>C: Select file (PDF/DOC/DOCX/TXT)
    C->>API: POST /api/documents/upload/:chatId<br/>multipart/form-data
    API->>API: Verify JWT, validate chatId
    API->>API: Multer: enforce 10MB + MIME check
    API->>DB: Compute checksum,<br/>check DOCUMENT_ALREADY_EXISTS

    alt Duplicate detected
        API-->>C: 409 DOCUMENT_ALREADY_EXISTS
    else Unique document
        API->>FS: Persist file
        API->>DB: Insert document (status: pending)
        API-->>C: 202 Accepted<br/>{ documentId, status: "pending" }
        API->>W: Enqueue ingestion job

        W->>FS: Read file
        W->>W: Extract text + chunk
        W->>V: Embed + index chunks
        W->>API: result (success or failure)
        API->>DB: Update document status
        API->>S: Emit document:update
        S-->>C: { documentId, status: "ingested",<br/>extractedSummary }
    end
```

---

## 6. Data Model / Entity Relationship

```mermaid
erDiagram
    USER     ||--o{ CHAT     : "owns"
    USER     ||--o{ MESSAGE  : "authors"
    USER     ||--o{ DOCUMENT : "uploads"
    CHAT     ||--o{ MESSAGE  : "contains"
    CHAT     ||--o{ DOCUMENT : "scoped to"
    MESSAGE  }o--o{ DOCUMENT : "references (documents[])"
    MESSAGE  ||--o{ CITATION : "embeds (response.citations[])"
    CITATION }o--o| DOCUMENT : "documentRef (when source='vector')"

    USER {
        ObjectId _id              PK
        string   email            UK "lowercase, trimmed, required"
        string   password            "bcrypt hash, select:false, min 8 chars"
        string   role                "enum: user|admin, default: user"
        Date     createdAt           "timestamps:true"
        Date     updatedAt           "timestamps:true"
    }

    CHAT {
        ObjectId _id              PK
        ObjectId user             FK "ref: User, indexed, required"
        string   title               "default: 'New Chat'"
        Date     lastMessageAt       "indexed, default: Date.now"
        Date     createdAt           "timestamps:true"
        Date     updatedAt           "timestamps:true"
    }

    MESSAGE {
        ObjectId _id              PK
        ObjectId chat             FK "ref: Chat, indexed, required"
        ObjectId user             FK "ref: User, required"
        string   query               "required"
        string   response_answer     "default: ''"
        ObjectId[] documents      FK "ref: Document, optional"
        string   status              "enum: pending|completed|failed"
        string   meta_model          "optional"
        number   meta_tokensUsed     "optional"
        number   meta_latencyMs      "optional"
        Date     createdAt           "timestamps:true"
        Date     updatedAt           "timestamps:true"
    }

    CITATION {
        number   id                  "required, no _id (embedded)"
        string  title               "required"
        string   source              "enum: vector|web, required"
        string   url                 "optional, for web sources"
        string   snippet             "optional, retrieved text"
        ObjectId documentRef     FK "ref: Document, optional"
    }

    DOCUMENT {
        ObjectId _id              PK
        ObjectId chat             FK "ref: Chat, indexed, required"
        ObjectId user             FK "ref: User, indexed, required"
        string   filename            "required"
        string   mimeType            "required"
        number   size                "bytes, required"
        string   storageUrl          "required, hidden in list responses"
        string   extractedSummary    "hidden in list responses"
        string   checksum         UK "indexed, dedupe key, hidden in list responses"
        string   status              "enum: pending|ingested|failed, indexed"
        string   errorMessage        "populated on failure"
        Date     createdAt           "timestamps:true"
        Date     updatedAt           "timestamps:true"
    }
```