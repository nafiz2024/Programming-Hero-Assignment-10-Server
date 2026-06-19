import { ObjectId } from "mongodb";

import { client } from "../config/db.js";

const paymentsCollection = client.db().collection("payment");

const createPaymentDocument = ({
  userId,
  userEmail,
  transactionId,
  amount,
  currency,
  paymentStatus,
  paymentMethod,
  plan,
  paidAt,
}) => {
  const now = new Date();

  return {
    _id: new ObjectId().toHexString(),
    userId,
    userEmail,
    transactionId,
    amount,
    currency,
    paymentStatus,
    paymentMethod,
    plan,
    paidAt,
    createdAt: now,
    updatedAt: now,
  };
};

export { createPaymentDocument, paymentsCollection };
