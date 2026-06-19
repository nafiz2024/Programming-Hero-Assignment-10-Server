import express from "express";

import {
  approvePrompt,
  copyPrompt,
  createPrompt,
  deletePrompt,
  featurePrompt,
  getAllPromptsForAdmin,
  getPromptById,
  getPendingPrompts,
  getPrompts,
  rejectPrompt,
  unfeaturePrompt,
  updatePrompt,
} from "../controllers/prompt.controller.js";
import verifyAuth, { authenticateRequest } from "../middleware/verifyAuth.js";
import verifyRole from "../middleware/verifyRole.js";

const router = express.Router();

router.post("/", verifyAuth, createPrompt);
router.get("/", getPrompts);
router.get("/pending/all", verifyAuth, verifyRole("admin"), getPendingPrompts);
router.get("/admin/all", verifyAuth, verifyRole("admin"), getAllPromptsForAdmin);
router.patch("/:id/approve", verifyAuth, verifyRole("admin"), approvePrompt);
router.patch("/:id/reject", verifyAuth, verifyRole("admin"), rejectPrompt);
router.patch("/:id/feature", verifyAuth, verifyRole("admin"), featurePrompt);
router.patch("/:id/unfeature", verifyAuth, verifyRole("admin"), unfeaturePrompt);
router.get("/:id", verifyAuthOptional, getPromptById);
router.patch("/:id/copy", verifyAuth, copyPrompt);
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
