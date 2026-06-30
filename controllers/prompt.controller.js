import { ObjectId } from "mongodb";

import {
  PROMPT_DIFFICULTIES,
  PROMPT_STATUSES,
  PROMPT_VISIBILITIES,
  createPromptDocument,
  promptsCollection,
} from "../models/prompt.model.js";
import { getUserId, normalizeId } from "../utils/identity.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const PREMIUM_LOCK_MESSAGE = "Subscribe to Premium to view this prompt.";
const COPY_PREMIUM_MESSAGE = "Premium subscription required to copy this prompt.";
const normalizePromptDocument = (prompt) => {
  if (!prompt) {
    return null;
  }

  const normalizedId = normalizeId(prompt._id || prompt.id || "");

  return {
    ...prompt,
    id: normalizedId,
    _id: normalizedId,
    creatorId: normalizeId(prompt.creatorId || prompt.creator?._id || prompt.creator?.id || ""),
    creatorName:
      prompt.creatorName ||
      prompt.creator?.name ||
      prompt.author?.name ||
      "PromptFlow Creator",
    creatorEmail:
      prompt.creatorEmail ||
      prompt.creator?.email ||
      prompt.author?.email ||
      "",
    status: prompt.status || "pending",
    copyCount: Number(prompt.copyCount || 0),
    featured: Boolean(prompt.featured),
  };
};

const parseTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const sanitizePromptInput = (body) => {
  return {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    content: String(body.content || "").trim(),
    category: String(body.category || "").trim(),
    aiTool: String(body.aiTool || "").trim(),
    tags: parseTags(body.tags),
    difficulty: String(body.difficulty || "").trim(),
    thumbnail: String(body.thumbnail || "").trim(),
    visibility: String(body.visibility || "").trim(),
  };
};

const validatePromptPayload = (payload) => {
  if (
    !payload.title ||
    !payload.description ||
    !payload.content ||
    !payload.category ||
    !payload.aiTool ||
    !payload.difficulty ||
    !payload.visibility
  ) {
    return "All required prompt fields must be provided";
  }

  if (!PROMPT_DIFFICULTIES.includes(payload.difficulty)) {
    return "Invalid difficulty";
  }

  if (!PROMPT_VISIBILITIES.includes(payload.visibility)) {
    return "Invalid visibility";
  }

  return null;
};

const validateUpdateValue = (field, value) => {
  if (!value) {
    return `${field} cannot be empty`;
  }

  return null;
};

const normalizeDifficultyFilter = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized === "advanced" || normalized === "pro") {
    return "pro";
  }

  if (normalized === "intermediate") {
    return "intermediate";
  }

  return "beginner";
};

const normalizeVisibilityFilter = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("premium") || normalized.includes("private")) {
    return "private";
  }

  if (normalized.includes("public")) {
    return "public";
  }

  return "";
};

const buildPublicPromptQuery = (query) => {
  const filters = {
    status: "approved",
  };

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");

    filters.$or = [
      { title: searchRegex },
      { tags: searchRegex },
      { aiTool: searchRegex },
    ];
  }

  if (query.category) {
    filters.category = query.category;
  }

  if (query.aiTool) {
    filters.aiTool = query.aiTool;
  }

  if (query.difficulty) {
    filters.difficulty = normalizeDifficultyFilter(query.difficulty);
  }

  const visibility = normalizeVisibilityFilter(query.visibility);

  if (visibility) {
    filters.visibility = visibility;
  }

  return filters;
};

const buildCreatorIdFilter = (user) => {
  const candidates = [getUserId(user), normalizeId(user?._id)].filter(Boolean);

  return {
    creatorId: {
      $in: [...new Set(candidates)],
    },
  };
};

const isOwnerPromptRequest = (query) => {
  const mine = String(query.mine || "").trim().toLowerCase();

  return mine === "true" || Boolean(query.creatorId) || Boolean(query.creatorEmail);
};

const buildSortOption = (sort) => {
  switch (sort) {
    case "rating":
      return { averageRating: -1, rating: -1, createdAt: -1 };
    case "popular":
    case "copied":
      return { copyCount: -1, createdAt: -1 };
    case "latest":
    default:
      return { createdAt: -1 };
  }
};

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildPromptIdQuery = (id) => {
  const normalized = normalizeId(id).trim();
  const candidates = [normalized];

  if (ObjectId.isValid(normalized)) {
    candidates.push(new ObjectId(normalized));
  }

  return {
    _id: { $in: candidates },
  };
};

const isPremiumVisibility = (visibility) => {
  const normalized = String(visibility || "").trim().toLowerCase();
  return normalized === "private" || normalized === "premium";
};

const findPromptById = async (id) => {
  return promptsCollection.findOne(buildPromptIdQuery(id));
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

const canManagePrompt = (user, prompt) => {
  if (!user) {
    return false;
  }

  return user.role === "admin" || getUserId(user) === normalizeId(prompt.creatorId);
};

const buildLockedPromptResponse = (prompt) => {
  const { content, ...promptMetadata } = prompt;

  return {
    ...promptMetadata,
    requiresPremium: true,
    isLocked: true,
    lockedReason: "premium_required",
    message: PREMIUM_LOCK_MESSAGE,
  };
};

const buildAdminPromptQuery = (query) => {
  const filters = {};

  if (query.status) {
    const normalizedStatus = String(query.status || "").trim().toLowerCase();

    if (normalizedStatus === "featured") {
      filters.featured = true;
    } else if (normalizedStatus !== "all" && PROMPT_STATUSES.includes(normalizedStatus)) {
      filters.status = normalizedStatus;
    }
  }

  if (query.featured !== undefined) {
    const normalized = String(query.featured).toLowerCase();

    if (normalized === "true") {
      filters.featured = true;
    } else if (normalized === "false") {
      filters.featured = false;
    }
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");

    filters.$or = [
      { title: searchRegex },
      { tags: searchRegex },
      { aiTool: searchRegex },
    ];
  }

  return filters;
};

const createPrompt = async (req, res) => {
  try {
    const payload = sanitizePromptInput(req.body);
    const validationError = validatePromptPayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    if (req.user.subscription === "free") {
      const promptCount = await promptsCollection.countDocuments({
        ...buildCreatorIdFilter(req.user),
      });

      if (promptCount >= 3) {
        return res.status(403).json({
          success: false,
          message: "Free users can create a maximum of 3 prompts",
        });
      }
    }

    const prompt = createPromptDocument(payload, req.user);

    await promptsCollection.insertOne(prompt);
    console.log(
      `[prompt:create] id=${prompt._id} creatorId=${prompt.creatorId} status=${prompt.status}`
    );

    return res.status(201).json({
      success: true,
      prompt: normalizePromptDocument(prompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create prompt",
    });
  }
};

const getPrompts = async (req, res) => {
  try {
    const ownerPromptRequest = isOwnerPromptRequest(req.query);

    if (ownerPromptRequest && !req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const filters = ownerPromptRequest
      ? buildCreatorIdFilter(req.user)
      : buildPublicPromptQuery(req.query);

    if (ownerPromptRequest && req.query.status) {
      const normalizedStatus = String(req.query.status || "").trim().toLowerCase();

      if (!PROMPT_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      filters.status = normalizedStatus;
    }

    const { page, limit, skip } = getPagination(req.query);
    const sort = buildSortOption(req.query.sort);

    const [prompts, total] = await Promise.all([
      promptsCollection.find(filters).sort(sort).skip(skip).limit(limit).toArray(),
      promptsCollection.countDocuments(filters),
    ]);

    return res.status(200).json({
      success: true,
      prompts: prompts.map(normalizePromptDocument),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prompts",
    });
  }
};

const getPromptById = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const isManager = canManagePrompt(req.user, prompt);
    const isApprovedPublic =
      prompt.status === "approved" && prompt.visibility === "public";
    const isPrivatePrompt = isPremiumVisibility(prompt.visibility);
    const isPremiumUser = hasPremiumAccess(req.user);

    if (isManager || isApprovedPublic) {
      return res.status(200).json({
        success: true,
        prompt: {
          ...normalizePromptDocument(prompt),
          requiresPremium: false,
          isLocked: false,
          lockedReason: "",
        },
      });
    }

    if (isPrivatePrompt) {
      if (isPremiumUser) {
        return res.status(200).json({
          success: true,
          prompt: {
            ...normalizePromptDocument(prompt),
            requiresPremium: false,
            isLocked: false,
            lockedReason: "",
          },
        });
      }

      return res.status(200).json({
        success: true,
        prompt: normalizePromptDocument(buildLockedPromptResponse(prompt)),
      });
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prompt",
    });
  }
};

const copyPrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const isManager = canManagePrompt(req.user, prompt);
    const isApprovedPublic =
      prompt.status === "approved" && prompt.visibility === "public";
    const isPrivatePrompt = isPremiumVisibility(prompt.visibility);
    const isPremiumUser = hasPremiumAccess(req.user);

    if (!isManager && !isApprovedPublic && !isPrivatePrompt) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    if (isPrivatePrompt && !isManager && !isPremiumUser) {
      return res.status(403).json({
        success: false,
        message: COPY_PREMIUM_MESSAGE,
      });
    }

    if (!isPrivatePrompt && !isManager && !isApprovedPublic) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $inc: { copyCount: 1 },
        $set: { updatedAt: new Date() },
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Prompt copied successfully",
      copyCount: updatedPrompt.copyCount,
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to copy prompt",
    });
  }
};

const updatePrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = getUserId(req.user) === normalizeId(prompt.creatorId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const updates = {};
    const editableFields = [
      "title",
      "description",
      "content",
      "category",
      "aiTool",
      "thumbnail",
      "visibility",
    ];

    for (const field of editableFields) {
      if (field in req.body) {
        const value = String(req.body[field] || "").trim();
        const validationError = validateUpdateValue(field, value);

        if (validationError) {
          return res.status(400).json({
            success: false,
            message: validationError,
          });
        }

        updates[field] = value;
      }
    }

    if ("tags" in req.body) {
      updates.tags = parseTags(req.body.tags);
    }

    if ("difficulty" in req.body) {
      const difficulty = String(req.body.difficulty || "").trim();

      if (!PROMPT_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: "Invalid difficulty",
        });
      }

      updates.difficulty = difficulty;
    }

    if ("visibility" in req.body) {
      const visibility = String(req.body.visibility || "").trim();

      if (!PROMPT_VISIBILITIES.includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid visibility",
        });
      }

      updates.visibility = visibility;
    }

    if (isAdmin) {
      if ("status" in req.body) {
        const status = String(req.body.status || "").trim();

        if (!PROMPT_STATUSES.includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid status",
          });
        }

        updates.status = status;
      }

      if ("rejectionFeedback" in req.body) {
        updates.rejectionFeedback = String(req.body.rejectionFeedback || "").trim();
      }

      if ("featured" in req.body) {
        updates.featured = Boolean(req.body.featured);
      }

      if ("copyCount" in req.body) {
        const copyCount = Number.parseInt(req.body.copyCount, 10);

        if (Number.isNaN(copyCount) || copyCount < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid copyCount",
          });
        }

        updates.copyCount = copyCount;
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    if (isOwner && !isAdmin) {
      updates.status = "pending";
      updates.rejectionFeedback = "";
    }

    updates.updatedAt = new Date();

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $set: updates,
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update prompt",
    });
  }
};

const deletePrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = getUserId(req.user) === normalizeId(prompt.creatorId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await promptsCollection.deleteOne(buildPromptIdQuery(req.params.id));

    return res.status(200).json({
      success: true,
      message: "Prompt deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete prompt",
    });
  }
};

const approvePrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $set: {
          status: "approved",
          rejectionFeedback: "",
          updatedAt: new Date(),
        },
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Prompt approved successfully",
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve prompt",
    });
  }
};

const rejectPrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const rejectionFeedback = String(req.body.rejectionFeedback || "").trim();

    if (!rejectionFeedback) {
      return res.status(400).json({
        success: false,
        message: "Rejection feedback is required",
      });
    }

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $set: {
          status: "rejected",
          rejectionFeedback,
          updatedAt: new Date(),
        },
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Prompt rejected successfully",
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject prompt",
    });
  }
};

const featurePrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $set: {
          featured: true,
          updatedAt: new Date(),
        },
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Prompt featured successfully",
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to feature prompt",
    });
  }
};

const unfeaturePrompt = async (req, res) => {
  try {
    const prompt = await findPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    await promptsCollection.updateOne(
      buildPromptIdQuery(req.params.id),
      {
        $set: {
          featured: false,
          updatedAt: new Date(),
        },
      }
    );

    const updatedPrompt = await findPromptById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Prompt unfeatured successfully",
      prompt: normalizePromptDocument(updatedPrompt),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unfeature prompt",
    });
  }
};

const getPendingPrompts = async (req, res) => {
  try {
    const prompts = await promptsCollection
      .find({ status: "pending" })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      prompts: prompts.map(normalizePromptDocument),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending prompts",
    });
  }
};

const getAllPromptsForAdmin = async (req, res) => {
  try {
    const filters = buildAdminPromptQuery(req.query);
    const prompts = await promptsCollection
      .find(filters)
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      prompts: prompts.map(normalizePromptDocument),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin prompts",
    });
  }
};

export {
  approvePrompt,
  copyPrompt,
  createPrompt,
  deletePrompt,
  featurePrompt,
  getAllPromptsForAdmin,
  getPromptById,
  getPendingPrompts,
  getPrompts,
  rejectPrompt,
  unfeaturePrompt,
  updatePrompt,
};
