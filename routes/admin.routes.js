import express from "express";

import {
  getAdminPayments,
  getAdminStats,
  getRecentActivity,
  getRevenue,
} from "../controllers/admin.controller.js";
import { getAllPromptsForAdmin } from "../controllers/prompt.controller.js";
import verifyAdminSession from "../middleware/verifyAdminSession.js";

const router = express.Router();

router.use(verifyAdminSession);

router.get("/stats", getAdminStats);
router.get("/payments", getAdminPayments);
router.get("/prompts", getAllPromptsForAdmin);
router.get("/revenue", getRevenue);
router.get("/recent-activity", getRecentActivity);

export default router;
