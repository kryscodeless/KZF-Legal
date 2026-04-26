const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/env");

const registerUser = async ({ email, password }) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email });

  // If user already exists, return a 409 error with message and code
  if (existingUser) {
    const error = new Error("A user with this email already exists");
    error.statusCode = 409;
    error.code = "USER_ALREADY_EXISTS";
    throw error;
  }

  // Create new user and save to database (password will be hashed by pre-save hook)
  const user = await User.create({
    email,
    password,
  });

  // Return safe user object without password
  return user.toSafeObject();
};

const loginUser = async (user) => {
  // User is already authenticated at this point, so we can directly sign and return a JWT token
  const token = jwt.sign(
    {
      userId: user.userId,
      role: user.role,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN },
  );

  // Return token, expiration time, and safe user object without password
  return {
    token,
    expiresIn: config.JWT_EXPIRES_IN,
    // User object is already safe as it was returned by the local strategy without password
    user: user,
  };
};

const getUserById = async (userId) => {
  // Retrieve user from database using ID from JWT payload
  const user = await User.findById(userId);

  // If user not found, throw a 404 error with message and code
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // If user is found, return safe user object without password
  return user.toSafeObject();
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
};
