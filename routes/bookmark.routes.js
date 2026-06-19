import express from "express";

import {
  getBookmarks,
  removeBookmark,
  toggleBookmark,
} from "../controllers/bookmark.controller.js";
import verifyAuth from "../middleware/verifyAuth.js";

const router = express.Router();

router.use(verifyAuth);

router.post("/:promptId", toggleBookmark);
router.get("/", getBookmarks);
router.delete("/:promptId", removeBookmark);

export default router;
