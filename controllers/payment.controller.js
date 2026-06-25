import Stripe from "stripe";

import { client } from "../config/db.js";
import { createPaymentDocument, paymentsCollection } from "../models/payment.model.js";

const usersCollection = client.db().collection("user");
const PREMIUM_PLAN = "premium";
const PAYMENT_AMOUNT = 5;
const PAYMENT_AMOUNT_CENTS = 500;
const PAYMENT_CURRENCY = "usd";
const PAYMENT_METHOD = "stripe_checkout";

function buildUserIdFilter(userOrId) {
  const rawId =
    userOrId && typeof userOrId === "object"
      ? userOrId._id ?? userOrId.id
      : userOrId;
  const candidates = [rawId, String(rawId)].filter(Boolean);

  return {
    _id: {
      $in: [...new Set(candidates)],
    },
  };
}

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getClientUrl() {
  return (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
}

function logPaymentEvent(step, details = {}) {
  console.info(`[payments] ${step}`, details);
}

function logPaymentError(step, error, details = {}) {
  console.error(`[payments] ${step}`, {
    ...details,
    message: error?.message,
    type: error?.type,
    code: error?.code,
    statusCode: error?.statusCode,
    rawType: error?.rawType,
    stack: error?.stack,
  });
}

async function activatePremiumForUser(user) {
  const premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await usersCollection.updateOne(
    buildUserIdFilter(user),
    {
      $set: {
        subscription: PREMIUM_PLAN,
        premiumUntil,
        updatedAt: new Date(),
      },
    }
  );

  return premiumUntil;
}

async function createCheckoutSession(req, res) {
  try {
    const stripe = getStripeClient();

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe secret key is not configured",
      });
    }

    const billingEmail = String(req.body?.billingEmail || req.user.email || "").trim();
    const billingName = String(req.body?.billingName || req.user.name || "").trim();
    const successUrl = `${getClientUrl()}/premium?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${getClientUrl()}/payment?payment=cancelled`;

    logPaymentEvent("create-checkout-session:start", {
      userId: req.user.id,
      billingEmail,
      hasBillingName: Boolean(billingName),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: req.user.id,
      customer_email: billingEmail || req.user.email,
      metadata: {
        userId: req.user.id,
        plan: PREMIUM_PLAN,
        billingEmail,
        billingName,
      },
      payment_intent_data: {
        metadata: {
          userId: req.user.id,
          plan: PREMIUM_PLAN,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PAYMENT_CURRENCY,
            unit_amount: PAYMENT_AMOUNT_CENTS,
            product_data: {
              name: "PromptFlow Premium",
              description: "One-time premium upgrade",
            },
          },
        },
      ],
    });

    logPaymentEvent("create-checkout-session:success", {
      userId: req.user.id,
      sessionId: session.id,
      urlPresent: Boolean(session.url),
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logPaymentError("create-checkout-session:failed", error, {
      userId: req.user?.id,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create Stripe checkout session",
    });
  }
}

async function finalizeCheckoutSession(req, res) {
  try {
    const stripe = getStripeClient();

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe secret key is not configured",
      });
    }

    const sessionId = String(req.body?.sessionId || "").trim();

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Stripe checkout session ID is required",
      });
    }

    logPaymentEvent("finalize-checkout:start", {
      userId: req.user.id,
      sessionId,
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (String(session.client_reference_id || "") !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "This checkout session does not belong to the current user",
      });
    }

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: `Stripe payment is not complete yet. Current status: ${session.payment_status || "unknown"}`,
      });
    }

    if (session.amount_total !== PAYMENT_AMOUNT_CENTS) {
      return res.status(400).json({
        success: false,
        message: `Unexpected payment amount: ${(session.amount_total || 0) / 100}`,
      });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

    const existingPayment = await paymentsCollection.findOne({
      $or: [{ sessionId }, { transactionId: paymentIntentId }],
    });

    const currentUser = await usersCollection.findOne(
      buildUserIdFilter(req.user),
      {
        projection: {
          subscription: 1,
          premiumUntil: 1,
        },
      }
    );
    const needsActivation =
      !existingPayment ||
      currentUser?.subscription !== PREMIUM_PLAN ||
      !currentUser?.premiumUntil;
    const premiumUntil = needsActivation
      ? await activatePremiumForUser(req.user)
      : new Date(currentUser.premiumUntil);

    if (!existingPayment) {
      const payment = createPaymentDocument({
        userId: req.user.id,
        userName: req.user.name || "",
        userEmail: req.user.email,
        transactionId: paymentIntentId,
        sessionId,
        amount: PAYMENT_AMOUNT,
        currency: session.currency || PAYMENT_CURRENCY,
        paymentStatus: session.payment_status,
        paymentMethod: PAYMENT_METHOD,
        plan: session.metadata?.plan || PREMIUM_PLAN,
        paidAt: new Date((session.created || Math.floor(Date.now() / 1000)) * 1000),
      });

      await paymentsCollection.insertOne(payment);
    }

    logPaymentEvent("finalize-checkout:success", {
      userId: req.user.id,
      sessionId,
      transactionId: paymentIntentId,
      reusedExistingPayment: Boolean(existingPayment),
    });

    return res.status(existingPayment ? 200 : 201).json({
      success: true,
      message: "Payment successful. Premium access activated.",
      transactionId: paymentIntentId,
      sessionId,
      subscription: PREMIUM_PLAN,
      premiumUntil,
    });
  } catch (error) {
    logPaymentError("finalize-checkout:failed", error, {
      userId: req.user?.id,
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to finalize Stripe checkout session",
    });
  }
}

async function getMyPayments(req, res) {
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
    logPaymentError("get-my-payments:failed", error, {
      userId: req.user?.id,
    });

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch payment history",
    });
  }
}

async function getAllPayments(req, res) {
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
    logPaymentError("get-all-payments:failed", error, {
      userId: req.user?.id,
    });

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch payments",
    });
  }
}

export { createCheckoutSession, finalizeCheckoutSession, getAllPayments, getMyPayments };
