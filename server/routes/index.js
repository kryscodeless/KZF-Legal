const express = require('express');
const authRoutes = require('./authRoutes');

// Initialize router
const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);

module.exports = router;