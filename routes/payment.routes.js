import express from "express";

import {
  createCheckoutSession,
  finalizeCheckoutSession,
  getAllPayments,
  getMyPayments,
} from "../controllers/payment.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole from "../middleware/verifyRole.js";

const router = express.Router();

router.post("/checkout-session", verifyAuth, createCheckoutSession);
router.post("/finalize-checkout", verifyAuth, finalizeCheckoutSession);
router.get("/my-payments", verifyAuth, getMyPayments);
router.get("/", verifyAuth, verifyRole("admin"), getAllPayments);

export default router;
