// Prisma configuration – see https://pris.ly/d/config-datasource
// DATABASE_URL must be set in .env (or the environment) before running
// any Prisma CLI commands or starting the application.
//
// Example (PostgreSQL):
//   DATABASE_URL="postgresql://user:password@localhost:5432/cloudorganiser?schema=public"
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
