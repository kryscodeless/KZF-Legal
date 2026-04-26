const express = require("express");
const authRoutes = require("./authRoutes");
const chatRoutes = require("./chatRoutes");
const historyRoutes = require("./historyRoutes");
const documentRoutes = require("./documentRoutes");
const adminRoutes = require("./adminRoutes");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

// Initialize router
const router = express.Router();

// Public routes
router.use("/auth", authRoutes);

// Protected routes (require authentication)
router.use("/chat", requireAuth, chatRoutes);
router.use("/history", requireAuth, historyRoutes);
router.use("/documents", requireAuth, documentRoutes);

// Admin routes (require admin role)
router.use("/admin", requireAdmin, adminRoutes);

module.exports = router;
