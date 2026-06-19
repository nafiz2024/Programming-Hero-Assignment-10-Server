import express from "express";

import {
  getAdminStats,
  getRecentActivity,
  getRevenue,
} from "../controllers/admin.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole from "../middleware/verifyRole.js";

const router = express.Router();

router.use(verifyAuth, verifyRole("admin"));

router.get("/stats", getAdminStats);
router.get("/revenue", getRevenue);
router.get("/recent-activity", getRecentActivity);

export default router;
