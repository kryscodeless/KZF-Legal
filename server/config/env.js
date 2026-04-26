const dotenv = require("dotenv");
const z = require("zod");

// Load environment variables from .env file
dotenv.config();

// Define a schema for environment variables
const envSchema = z.object({
  // Server configuration
  PORT: z
    .string()
    .default("3000")
    .transform((value) => parseInt(value, 10)),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database configuration
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // JWT configuration
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),

  JWT_EXPIRES_IN: z.string().default("7d"),
});

// Parse and validate process.env against the schema
const parsed = envSchema.safeParse(process.env);

// If validation fails, log detailed errors and exit
if (!parsed.success) {
  console.error("Environment configuration error:");
  // Log each validation error in a readable format
  parsed.error.issues.forEach((err) => {
    console.error(`  - ${err.path.join(".")}: ${err.message}`);
  });
  console.error("Please check your .env file against .env.example");
  // Exit with a non-zero code to indicate failure
  process.exit(1);
}

// Export the validated, typed config object
const config = parsed.data;

module.exports = config;
