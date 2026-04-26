const express = require("express");

// Initialize router
const router = express.Router();

// Chat route (placeholder)
router.post("/", (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      message: "Not implemented",
      code: "NOT_IMPLEMENTED",
    },
  });
});

module.exports = router;
