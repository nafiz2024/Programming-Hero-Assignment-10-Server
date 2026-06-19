import express from "express";
import { toNodeHandler } from "better-auth/node";

import { auth } from "../config/auth.js";

const router = express.Router();
const authHandler = toNodeHandler(auth);

router.all("/", authHandler);
router.all("/*splat", authHandler);

export default router;
