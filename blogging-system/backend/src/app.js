// Configure environment variables
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

// Set's our port to the PORT environment variable, or 3000 by default if the env is not configured.
const PORT = process.env.PORT ?? 3000;

// Creates the express server
const app = express();

/**
 * Configure middleware (logging, CORS support, JSON parsing support,
 * static files support, cookie parser)
 *
 * CORS is configured to allow cookies and these two origins from fetch() requests.
 * Feel free to reconfigure if required, or add your own middleware.
 */
app.use(morgan("dev"));
app.use(cookieParser());
// Support multiple frontend origins from .env (comma-separated)
const frontendOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: [`http://localhost:${PORT}`, ...frontendOrigins],
    credentials: true
  })
);
app.use(express.json());
app.use(express.static("public"));

// Import and use our application routes.
import routes from "./routes/routes.js";
app.use("/", routes);

// Make sure our database is up and running
import { getDatabase } from "./data/database.js";
await getDatabase();

// Start the server running.
app.listen(PORT, () => {
  console.log(`PGCIT Final Project server listening on port ${PORT}`);
});
