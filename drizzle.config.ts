import { defineConfig } from "drizzle-kit";

// Only load .env.local in local development (file exists)
// In Docker, environment variables are passed directly, so this isn't needed
try {
  require("dotenv").config({ path: ".env.local" });
} catch {
  // dotenv not available or .env.local doesn't exist - that's fine
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
