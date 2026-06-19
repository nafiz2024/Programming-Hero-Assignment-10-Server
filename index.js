import "dotenv/config";

import cors from "cors";
import express from "express";

import bookmarkRoutes from "./routes/bookmark.routes.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import promptRoutes from "./routes/prompt.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const jsonMiddleware = express.json();

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }

  return jsonMiddleware(req, res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PromptFlow server running",
  });
});

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
