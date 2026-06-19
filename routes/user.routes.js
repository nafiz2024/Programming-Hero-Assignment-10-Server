import express from "express";

import { client } from "../config/db.js";
import verifyAuth from "../middleware/verifyAuth.js";
import verifyRole, { ALLOWED_ROLES } from "../middleware/verifyRole.js";

const router = express.Router();
const usersCollection = client.db().collection("user");

router.get("/me", verifyAuth, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
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
      users,
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
      { _id: req.params.id },
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
      { _id: req.params.id },
      {
        projection: {
          password: 0,
        },
      }
    );

    return res.status(200).json({
      success: true,
      user: updatedUser,
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
    const result = await usersCollection.deleteOne({ _id: req.params.id });

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
