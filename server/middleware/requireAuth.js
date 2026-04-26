const passport = require("passport");

const requireAuth = (req, res, next) => {
  // Use Passport's JWT strategy to authenticate the request
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    // Pass any authentication errors to the next layer
    if (err) {
      return next(err);
    }

    // If no user is found, return a 401 Unauthorized response
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: "Unauthorized: Invalid or missing session token",
          code: "AUTH_INVALID_TOKEN",
        },
      });
    }

    // Attach the authenticated user to the request object for downstream use
    req.user = user;
    next();
  })(req, res, next);
};

module.exports = requireAuth;
