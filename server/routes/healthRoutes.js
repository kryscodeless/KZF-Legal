const express = require('express');

// Initialize router
const router = express.Router();

// Health check route
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: "ok",
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: "1.0.0",
        },
    });
});

module.exports = router;