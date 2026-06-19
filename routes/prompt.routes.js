import express from "express";

import {
  createPrompt,
  deletePrompt,
  getPromptById,
  getPrompts,
  updatePrompt,
} from "../controllers/prompt.controller.js";
import verifyAuth, { authenticateRequest } from "../middleware/verifyAuth.js";

const router = express.Router();

router.post("/", verifyAuth, createPrompt);
router.get("/", getPrompts);
router.get("/:id", verifyAuthOptional, getPromptById);
router.patch("/:id", verifyAuth, updatePrompt);
router.delete("/:id", verifyAuth, deletePrompt);

async function verifyAuthOptional(req, res, next) {
  try {
    const authData = await authenticateRequest(req);

    if (authData) {
      req.session = authData.session;
      req.user = authData.user;
    }

    return next();
  } catch (error) {
    return next();
  }
}

export default router;
