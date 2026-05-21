const config = require("./config/env");
const app = require("./app");
const logger = require("./utils/logger");
const connectDB = require("./config/database");
const authenticateSocket = require("./middleware/authenticateSocket");
const http = require("http");
const { Server } = require("socket.io");

// Take environment variables from .env file
const PORT = config.PORT;

// Create HTTP server from the Express app
const server = http.createServer(app);

// Init Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.ALLOWED_ORIGINS.split(","),
    credentials: true,
  },
});

// Apply JWT middleware to all socket connections
io.use(authenticateSocket);

// Simple room join — client joins their own user room
io.on("connection", (socket) => {
  // userId is available on socket.user from the authentication middleware
  const userId = socket.user.id;

  // Join a room specific to the user for targeted message delivery
  socket.join(`user:${userId}`);
  logger.info(
    { userId, socketId: socket.id },
    "Authenticated user joined room",
  );

  // Handle socket disconnection
  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

// Make io accessible in controllers via app
app.set("io", io);

const startServer = async () => {
  // Connect to the database before starting the server
  await connectDB();

  server.listen(PORT, () => {
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Landing page: http://localhost:${PORT}/`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
