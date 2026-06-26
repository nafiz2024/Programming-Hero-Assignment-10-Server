import "dotenv/config";

import cors from "cors";
import express from "express";

import adminRoutes from "./routes/admin.routes.js";
import bookmarkRoutes from "./routes/bookmark.routes.js";
import { connectDB } from "./config/db.js";
import { normalizedAllowedOrigins } from "./config/cors.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import authRoutes from "./routes/auth.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import promptRoutes from "./routes/prompt.routes.js";
import reportRoutes from "./routes/report.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const jsonMiddleware = express.json();
const corsOptions = {
  origin: normalizedAllowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth")) {
    return next();
  }

  return jsonMiddleware(req, res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookmarks", bookmarkRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    service: "PromptFlow API",
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PromptFlow server running",
  });
});

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
