## Frontend

The frontend is a vanilla HTML/CSS/JavaScript application served from the `public/` folder.

### Pages

| Page | File | Description |
|------|------|-------------|
| Login / Register | `index.html` | Authentication screens for signing in or creating an account. Connects to `/api/login-page` and `/api/register-page`. |
| Home | `index.html` | Dashboard shown after login. Displays a greeting, quick ask box, recent conversations, and shortcuts to other pages. |
| Chat | `index.html` | Main AI conversation interface. Messages are sent to the backend via Socket.io and responses are rendered with citation badges. |
| Upload | `index.html` | Uploaded documents from the chats are uploaded and stored within this page. `/api/upload-page`. |
| History | `index.html` | Lists all past conversation sessions with search and date filtering. Supports resume and delete actions. |

### Frontend Files 

| File | Description |
|------|-------------|
| `public/css/styles.css` | All styling design tokens, layout, components. |
| `public/js/chat.js` | Handles message rendering, typing indicator, suggestion chips, and session title updates. User is able to upload documents from the chat. |
| `public/js/socket.js` | Manages the Socket.io connection. Authenticates with the session token from login and listens for `chat:response` events. |
| `public/js/upload.js` | Storage base for the uploaded documents from the user. |
| `public/js/app.js` | Handles main functionality of the app flow states. |

### Socket Events

All events are emitted to the room `user:<userId>` after JWT authentication
of the socket connection.

| Event | Direction | Payload (success) | Payload (failure) |
|---|---|---|---|
| `chat:update` | Server → Client | `{ messageId, status: "completed", response: { answer, citations[] } }` | `{ messageId, status: "failed", error }` |
| `document:update` | Server → Client | `{ documentId, status: "ingested", extractedSummary }` | `{ documentId, status: "failed", error }` |
