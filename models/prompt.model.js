import { ObjectId } from "mongodb";

import { client } from "../config/db.js";
import { getUserId } from "../utils/identity.js";

const PROMPT_DIFFICULTIES = ["beginner", "intermediate", "pro"];
const PROMPT_VISIBILITIES = ["public", "private"];
const PROMPT_STATUSES = ["pending", "approved", "rejected"];

const promptsCollection = client.db().collection("prompt");

const createPromptDocument = (data, user) => {
  const creatorId = getUserId(user);

  return {
    _id: new ObjectId().toHexString(),
    title: data.title,
    description: data.description,
    content: data.content,
    category: data.category,
    aiTool: data.aiTool,
    tags: data.tags,
    difficulty: data.difficulty,
    thumbnail: data.thumbnail,
    visibility: data.visibility,
    status: "pending",
    rejectionFeedback: "",
    creatorId,
    creatorName: String(user?.name || "").trim(),
    creatorEmail: String(user?.email || "").trim(),
    copyCount: 0,
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export {
  PROMPT_DIFFICULTIES,
  PROMPT_STATUSES,
  PROMPT_VISIBILITIES,
  createPromptDocument,
  promptsCollection,
};
