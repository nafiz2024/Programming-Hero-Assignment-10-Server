import { ObjectId } from "mongodb";

import { bookmarksCollection, createBookmarkDocument } from "../models/bookmark.model.js";
import { promptsCollection } from "../models/prompt.model.js";

const normalizeId = (value) => String(value || "").trim();

const buildPromptIdCandidates = (promptId) => {
  const normalized = normalizeId(promptId);
  const candidates = [normalized];

  if (ObjectId.isValid(normalized)) {
    candidates.push(new ObjectId(normalized));
  }

  return candidates;
};

const toggleBookmark = async (req, res) => {
  try {
    const { promptId } = req.params;
    const promptIdCandidates = buildPromptIdCandidates(promptId);

    const prompt = await promptsCollection.findOne({
      _id: { $in: promptIdCandidates },
    });

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: "Prompt not found",
      });
    }

    const existingBookmark = await bookmarksCollection.findOne({
      userId: req.user.id,
      promptId: { $in: promptIdCandidates },
    });

    if (existingBookmark) {
      await bookmarksCollection.deleteOne({ _id: existingBookmark._id });

      return res.status(200).json({
        success: true,
        message: "Bookmark removed successfully",
        bookmarked: false,
      });
    }

    const bookmark = createBookmarkDocument(req.user.id, String(prompt._id));

    await bookmarksCollection.insertOne(bookmark);

    return res.status(201).json({
      success: true,
      message: "Bookmark added successfully",
      bookmarked: true,
      bookmark,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle bookmark",
    });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await bookmarksCollection
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    const promptIds = bookmarks.flatMap((bookmark) => buildPromptIdCandidates(bookmark.promptId));
    const prompts = promptIds.length
      ? await promptsCollection.find({ _id: { $in: promptIds } }).toArray()
      : [];

    const promptMap = new Map(prompts.map((prompt) => [prompt._id, prompt]));

    const savedPrompts = bookmarks
      .map((bookmark) => ({
        ...bookmark,
        prompt: promptMap.get(bookmark.promptId) || null,
      }))
      .filter((bookmark) => bookmark.prompt);

    return res.status(200).json({
      success: true,
      bookmarks: savedPrompts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookmarks",
    });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const { promptId } = req.params;
    const promptIdCandidates = buildPromptIdCandidates(promptId);

    const existingBookmark = await bookmarksCollection.findOne({
      userId: req.user.id,
      promptId: { $in: promptIdCandidates },
    });

    if (!existingBookmark) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    await bookmarksCollection.deleteOne({ _id: existingBookmark._id });

    return res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove bookmark",
    });
  }
};

export { getBookmarks, removeBookmark, toggleBookmark };
