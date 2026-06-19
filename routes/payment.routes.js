import express from "express";

import {
  confirmPayment,
  createPaymentIntent,
  getAllPayments,
  getMyPayments,
} from "../controllers/payment.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole from "../middleware/verifyRole.js";

const router = express.Router();

router.post("/create-payment-intent", verifyAuth, createPaymentIntent);
router.post("/confirm-payment", verifyAuth, confirmPayment);
router.get("/my-payments", verifyAuth, getMyPayments);
router.get("/", verifyAuth, verifyRole("admin"), getAllPayments);

export default router;
