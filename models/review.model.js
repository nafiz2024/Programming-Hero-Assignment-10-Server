import { ObjectId } from "mongodb";

import { client } from "../config/db.js";

const reviewsCollection = client.db().collection("review");

const createReviewDocument = (promptId, user, rating, comment) => {
  const now = new Date();

  return {
    _id: new ObjectId().toHexString(),
    promptId,
    userId: user.id,
    userName: user.name,
    rating,
    comment,
    createdAt: now,
    updatedAt: now,
  };
};

export { createReviewDocument, reviewsCollection };
