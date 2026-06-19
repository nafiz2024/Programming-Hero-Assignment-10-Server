import express from "express";

import {
  createReport,
  dismissReport,
  getReports,
  removePromptFromReport,
  warnCreator,
} from "../controllers/report.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole from "../middleware/verifyRole.js";

const router = express.Router();

router.post("/:promptId", verifyAuth, createReport);
router.get("/", verifyAuth, verifyRole("admin"), getReports);
router.patch(
  "/:id/remove-prompt",
  verifyAuth,
  verifyRole("admin"),
  removePromptFromReport
);
router.patch(
  "/:id/warn-creator",
  verifyAuth,
  verifyRole("admin"),
  warnCreator
);
router.patch("/:id/dismiss", verifyAuth, verifyRole("admin"), dismissReport);

export default router;
