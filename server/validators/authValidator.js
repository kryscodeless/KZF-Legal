const z = require("zod");

// Validation schema for user registration
const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

// Validation schema for user login
const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Please provide a valid email address"),
    password: z.string().min(1, "Password is required"),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
};
