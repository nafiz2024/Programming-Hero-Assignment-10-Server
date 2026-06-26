import express from "express";

import {
  createBookmark,
  getBookmarks,
  removeBookmark,
} from "../controllers/bookmark.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";

const router = express.Router();

router.use(verifyAuth);

router.post("/:promptId", createBookmark);
router.get("/", getBookmarks);
router.delete("/:promptId", removeBookmark);

export default router;
