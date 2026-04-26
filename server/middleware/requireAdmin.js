const requireAuth = require("./requireAuth");

const requireAdmin = (req, res, next) => {
  // First, ensure the user is authenticated
  requireAuth(req, res, (err) => {
    if (err) {
      return next(err);
    }

    // Check the authenticated user's role
    if (req.user && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: {
          message: "Forbidden: Admin access required",
          code: "FORBIDDEN",
        },
      });
    }

    next();
  });
};

module.exports = requireAdmin;
