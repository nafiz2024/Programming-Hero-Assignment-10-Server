import { ObjectId } from "mongodb";

import { promptsCollection } from "../models/prompt.model.js";
import { createReviewDocument, reviewsCollection } from "../models/review.model.js";

const normalizeId = (value) => String(value);
const PREMIUM_REVIEW_MESSAGE = "Premium subscription required to review this prompt.";

const parseRating = (value) => Number.parseInt(value, 10);
const buildPromptIdCandidates = (promptId) => {
  const normalized = normalizeId(promptId).trim();
  const candidates = [normalized];

  if (ObjectId.isValid(normalized)) {
    candidates.push(new ObjectId(normalized));
  }

  return [...new Set(candidates)];
};

const hasPremiumAccess = (user) => {
  if (!user || user.subscription !== "premium") {
    return false;
  }

  if (!user.premiumUntil) {
    return true;
  }

  return new Date(user.premiumUntil) > new Date();
};

const validateReviewInput = (rating, comment) => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Rating must be between 1 and 5";
  }

  if (!comment) {
    return "Comment is required";
  }

  return null;
};

const getReviewStats = (reviews) => {
  const totalReviews = reviews.length;
  const averageRating = totalReviews
    ? Number(
        (
          reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        ).toFixed(2)
      )
    : 0;

  return {
    averageRating,
    totalReviews,
  };
};

const upsertReview = async (req, res) => {
  try {
    const { promptId } = req.params;
    const rating = parseRating(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    const prompt = await promptsCollection.findOne({
      _id: { $in: buildPromptIdCandidates(promptId) },
    });

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const isManager =
      req.user.role === "admin" ||
      normalizeId(req.user.id) === normalizeId(prompt.creatorId);

    if (
      prompt.visibility === "private" &&
      !isManager &&
      !hasPremiumAccess(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message: PREMIUM_REVIEW_MESSAGE,
      });
    }

    const validationError = validateReviewInput(rating, comment);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const existingReview = await reviewsCollection.findOne({
      promptId: { $in: buildPromptIdCandidates(promptId) },
      userId: req.user.id,
    });

    if (existingReview) {
      await reviewsCollection.updateOne(
        { _id: existingReview._id },
        {
          $set: {
            rating,
            comment,
            userName: req.user.name,
            updatedAt: new Date(),
          },
        }
      );

      const updatedReview = await reviewsCollection.findOne({
        _id: existingReview._id,
      });

      return res.status(200).json({
        success: true,
        message: "Review updated successfully",
        review: updatedReview,
      });
    }

    const review = createReviewDocument(promptId, req.user, rating, comment);

    await reviewsCollection.insertOne(review);

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      review,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit review",
    });
  }
};

const getReviewsByPrompt = async (req, res) => {
  try {
    const { promptId } = req.params;

    const prompt = await promptsCollection.findOne({
      _id: { $in: buildPromptIdCandidates(promptId) },
    });

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const reviews = await reviewsCollection
      .find({ promptId: { $in: buildPromptIdCandidates(promptId) } })
      .sort({ createdAt: -1 })
      .toArray();

    const { averageRating, totalReviews } = getReviewStats(reviews);

    return res.status(200).json({
      success: true,
      reviews,
      averageRating,
      totalReviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { promptId } = req.params;
    const targetUserId =
      req.user.role === "admin" && req.query.userId
        ? String(req.query.userId)
        : req.user.id;

    const review = await reviewsCollection.findOne({
      promptId: { $in: buildPromptIdCandidates(promptId) },
      userId: targetUserId,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const isOwner = normalizeId(review.userId) === normalizeId(req.user.id);
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await reviewsCollection.deleteOne({ _id: review._id });

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
};

export { deleteReview, getReviewsByPrompt, upsertReview };
