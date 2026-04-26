const express = require("express");
const passport = require("./config/passport");
const routes = require("./routes");

// Initialize Express app
const app = express();

// Global middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport (without session as JWT is stateless)
app.use(passport.initialize());

// API routes
app.use("/api", routes);

module.exports = app;
