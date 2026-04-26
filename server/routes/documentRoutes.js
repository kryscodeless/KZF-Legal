const express = require("express");

// Initialize router
const router = express.Router();

// Upload document route (placeholder)
router.post("/", (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      message: "Not implemented",
      code: "NOT_IMPLEMENTED",
    },
  });
});

// Retrieve all documents route (placeholder)
router.get("/", (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      message: "Not implemented",
      code: "NOT_IMPLEMENTED",
    },
  });
});

// Retrieve specific document route (placeholder)
router.get("/:documentID", (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      message: "Not implemented",
      code: "NOT_IMPLEMENTED",
    },
  });
});

// Delete document route (placeholder)
router.delete("/:documentID", (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      message: "Not implemented",
      code: "NOT_IMPLEMENTED",
    },
  });
});

module.exports = router;
