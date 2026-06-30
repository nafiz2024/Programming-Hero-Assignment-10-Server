import express from "express";
import { ObjectId } from "mongodb";

import { client } from "../config/db.js";
import {
  getAdminPayments,
  getAdminStats,
  getRecentActivity,
  getRevenue,
} from "../controllers/admin.controller.js";
import { getAllPromptsForAdmin } from "../controllers/prompt.controller.js";
import verifyAdminSession from "../middleware/verifyAdminSession.js";
import { ALLOWED_ROLES } from "../middleware/verifyRole.js";

const router = express.Router();
const usersCollection = client.db().collection("user");

const normalizeId = (value) => String(value ?? "").trim();

const buildUserIdQuery = (id) => {
  const normalized = normalizeId(id);
  const candidates = [normalized].filter(Boolean);

  if (ObjectId.isValid(normalized)) {
    candidates.push(new ObjectId(normalized));
  }

  return {
    _id: {
      $in: [...new Set(candidates)],
    },
  };
};

const normalizeUserDocument = (user) => {
  if (!user) {
    return null;
  }

  const normalizedId = normalizeId(user._id || user.id);

  return {
    ...user,
    id: normalizedId,
    _id: normalizedId,
  };
};

router.use(verifyAdminSession);

router.get("/users", async (req, res) => {
  try {
    const users = await usersCollection
      .find(
        {},
        {
          projection: {
            password: 0,
          },
        }
      )
      .toArray();

    return res.status(200).json({
      success: true,
      users: users.map(normalizeUserDocument),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const result = await usersCollection.updateOne(buildUserIdQuery(req.params.id), {
      $set: {
        role,
        updatedAt: new Date(),
      },
    });

    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await usersCollection.findOne(buildUserIdQuery(req.params.id), {
      projection: {
        password: 0,
      },
    });

    return res.status(200).json({
      success: true,
      user: normalizeUserDocument(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const result = await usersCollection.deleteOne(buildUserIdQuery(req.params.id));

    if (!result.deletedCount) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

router.get("/stats", getAdminStats);
router.get("/payments", getAdminPayments);
router.get("/prompts", getAllPromptsForAdmin);
router.get("/revenue", getRevenue);
router.get("/recent-activity", getRecentActivity);

export default router;
