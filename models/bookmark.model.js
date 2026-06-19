import { ObjectId } from "mongodb";

import { client } from "../config/db.js";

const bookmarksCollection = client.db().collection("bookmark");

const createBookmarkDocument = (userId, promptId) => {
  return {
    _id: new ObjectId().toHexString(),
    userId,
    promptId,
    createdAt: new Date(),
  };
};

export { bookmarksCollection, createBookmarkDocument };
