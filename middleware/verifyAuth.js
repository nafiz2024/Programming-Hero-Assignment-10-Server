import { client } from "../config/db.js";
import { getUserId, normalizeId } from "../utils/identity.js";

const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
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

const authenticateRequest = async (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const signedSessionToken = SESSION_COOKIE_NAMES.map((name) => cookies[name]).find(Boolean);

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

  const user = await client.db().collection("user").findOne({
    _id: session.userId,
  });

  if (!user) {
    return null;
  }

  return {
    session: {
      ...session,
      id: normalizeId(session._id),
    },
    user: {
      ...user,
      id: getUserId(user),
      _id: normalizeId(user._id),
    },
  };
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
