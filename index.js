import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use(express.json());

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
