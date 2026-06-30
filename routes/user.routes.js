import express from "express";
import { ObjectId } from "mongodb";

import { client } from "../config/db.js";
import { authenticateRequest } from "../middleware/verifyAuth.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole, { ALLOWED_ROLES } from "../middleware/verifyRole.js";

const router = express.Router();
const usersCollection = client.db().collection("user");
const normalizeId = (value) => String(value);
const buildUserIdQuery = (id) => {
  const normalized = normalizeId(id).trim();
  const candidates = [normalized];

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

  const normalizedId = normalizeId(user._id || user.id || "");

  return {
    ...user,
    id: normalizedId,
    _id: normalizedId,
  };
};

router.get("/me", async (req, res) => {
  try {
    const authData = await authenticateRequest(req);
    const hasCookie = Boolean(req.headers.cookie?.trim());

    console.log("[GET /api/users/me]", {
      hasCookie,
      sessionUserId: authData?.user?.id || null,
      sessionUserEmail: authData?.user?.email || null,
      returnedUserRole: authData?.user?.role || null,
    });

    if (!authData?.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.session = authData.session;
    req.user = authData.user;

    return res.status(200).json({
      success: true,
      user: normalizeUserDocument(req.user),
    });
  } catch (error) {
    console.error("[GET /api/users/me] failed to verify session cookie", error);

    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
});

router.get("/", verifyAuth, verifyRole("admin"), async (req, res) => {
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

router.patch("/:id/role", verifyAuth, verifyRole("admin"), async (req, res) => {
  try {
    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const result = await usersCollection.updateOne(
      buildUserIdQuery(req.params.id),
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await usersCollection.findOne(
      buildUserIdQuery(req.params.id),
      {
        projection: {
          password: 0,
        },
      }
    );

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

router.delete("/:id", verifyAuth, verifyRole("admin"), async (req, res) => {
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

export default router;
