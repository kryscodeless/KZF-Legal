const config = require("./config/env");
const app = require("./app");
const connectDB = require("./config/database");

const PORT = config.PORT;

const startServer = async () => {
  // Connect to the database before starting the server
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
};

startServer();
