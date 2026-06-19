import Stripe from "stripe";

import { client } from "../config/db.js";
import { createPaymentDocument, paymentsCollection } from "../models/payment.model.js";

const usersCollection = client.db().collection("user");
const PREMIUM_PLAN = "premium";
const PAYMENT_AMOUNT = 5;
const PAYMENT_AMOUNT_CENTS = 500;
const PAYMENT_CURRENCY = "usd";

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const activatePremiumForUser = async (userId) => {
  const premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await usersCollection.updateOne(
    { _id: String(userId) },
    {
      $set: {
        subscription: PREMIUM_PLAN,
        premiumUntil,
        updatedAt: new Date(),
      },
    }
  );

  return premiumUntil;
};

const createPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripeClient();

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe secret key is not configured",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PAYMENT_AMOUNT_CENTS,
      currency: PAYMENT_CURRENCY,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: req.user.id,
        plan: PREMIUM_PLAN,
      },
      receipt_email: req.user.email,
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { transactionId, amount, currency, paymentMethod } = req.body;

    if (
      !transactionId ||
      amount !== PAYMENT_AMOUNT ||
      currency !== PAYMENT_CURRENCY ||
      paymentMethod !== "stripe"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment details",
      });
    }

    const existingPayment = await paymentsCollection.findOne({ transactionId });

    if (existingPayment && existingPayment.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "This payment has already been used by another user",
      });
    }

    const premiumUntil = await activatePremiumForUser(req.user.id);

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Payment successful. Premium access activated.",
        transactionId: existingPayment.transactionId,
        subscription: PREMIUM_PLAN,
        premiumUntil,
      });
    }

    const payment = createPaymentDocument({
      userId: req.user.id,
      userEmail: req.user.email,
      transactionId,
      amount,
      currency,
      paymentStatus: "succeeded",
      paymentMethod,
      plan: PREMIUM_PLAN,
      paidAt: new Date(),
    });

    await paymentsCollection.insertOne(payment);

    return res.status(201).json({
      success: true,
      message: "Payment successful. Premium access activated.",
      transactionId,
      subscription: PREMIUM_PLAN,
      premiumUntil,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
    });
  }
};

const getMyPayments = async (req, res) => {
  try {
    const payments = await paymentsCollection
      .find({ userId: req.user.id })
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1, createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

export { confirmPayment, createPaymentIntent, getAllPayments, getMyPayments };
