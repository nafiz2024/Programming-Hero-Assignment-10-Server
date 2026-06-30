import { ObjectId } from "mongodb";

import { auth } from "../config/auth.js";
import { client } from "../config/db.js";
import { getUserId, normalizeId } from "../utils/identity.js";

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
  "__Secure-better-auth-session_token",
  "better-auth-session_token",
];

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) {
      return cookies;
    }

    cookies[name] = valueParts.join("=");
    return cookies;
  }, {});
};

const getCookieValue = (cookies, cookieNames) => {
  for (const cookieName of cookieNames) {
    if (cookies[cookieName]) {
      return cookies[cookieName];
    }

    const chunkedCookieEntries = Object.entries(cookies)
      .filter(([name]) => name.startsWith(`${cookieName}.`))
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));

    if (chunkedCookieEntries.length) {
      return chunkedCookieEntries.map(([, value]) => value).join("");
    }
  }

  return null;
};

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

const normalizeAuthResult = (session, user) => {
  if (!session || !user) {
    return null;
  }

  return {
    session: {
      ...session,
      id: normalizeId(session._id || session.id),
    },
    user: {
      ...user,
      id: getUserId(user),
      _id: normalizeId(user._id || user.id),
    },
  };
};

const findUserForSession = async ({ session, user }) => {
  const sessionUser = user || {};
  const userId = normalizeId(
    sessionUser?._id || sessionUser?.id || sessionUser?.userId || session?.userId
  );

  if (userId) {
    const matchedUser = await client
      .db()
      .collection("user")
      .findOne(buildUserIdQuery(userId));

    if (matchedUser) {
      return matchedUser;
    }
  }

  const email = String(sessionUser?.email || "").trim().toLowerCase();

  if (!email) {
    return null;
  }

  return client.db().collection("user").findOne({
    email: {
      $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });
};

const authenticateViaBetterAuth = async (req) => {
  let sessionPayload = null;

  try {
    sessionPayload = await auth.api.getSession({
      headers: new Headers(req.headers),
    });
  } catch (error) {
    return null;
  }

  if (!sessionPayload?.session || !sessionPayload?.user) {
    return null;
  }

  const dbUser = await findUserForSession({
    session: sessionPayload.session,
    user: sessionPayload.user,
  });

  return normalizeAuthResult(sessionPayload.session, {
    ...sessionPayload.user,
    ...(dbUser || {}),
  });
};

const authenticateRequest = async (req) => {
  const betterAuthSession = await authenticateViaBetterAuth(req);

  if (betterAuthSession) {
    return betterAuthSession;
  }

  const cookies = parseCookies(req.headers.cookie);
  const signedSessionToken = getCookieValue(cookies, SESSION_COOKIE_NAMES);

  if (!signedSessionToken) {
    return null;
  }

  const sessionToken = decodeURIComponent(signedSessionToken).split(".")[0];

  const session = await client.db().collection("session").findOne({
    token: sessionToken,
  });

  if (!session || new Date(session.expiresAt) <= new Date()) {
    return null;
  }

  const user = await findUserForSession({
    session,
    user: {
      id: session.userId,
      _id: session.userId,
    },
  });

  if (!user) {
    return null;
  }

  return normalizeAuthResult(session, user);
};

const verifyAuth = async (req, res, next) => {
  try {
    const authData = await authenticateRequest(req);

    if (!authData) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.session = authData.session;
    req.user = authData.user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

export { authenticateRequest };
export default verifyAuth;
