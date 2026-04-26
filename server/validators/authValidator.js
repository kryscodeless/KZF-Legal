const z = require("zod");

// Validation schema for user registration
const registerSchema = z.object({
  email: z.email("Please provide a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

// Validation schema for user login
const loginSchema = z.object({
  email: z.email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

module.exports = {
  registerSchema,
  loginSchema,
};
