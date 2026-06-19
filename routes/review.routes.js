import express from "express";

import {
  deleteReview,
  getReviewsByPrompt,
  upsertReview,
} from "../controllers/review.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";

const router = express.Router();

router.post("/:promptId", verifyAuth, upsertReview);
router.get("/:promptId", getReviewsByPrompt);
router.delete("/:promptId", verifyAuth, deleteReview);

export default router;
