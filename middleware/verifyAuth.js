import { client } from "../config/db.js";

const SESSION_COOKIE_NAME = "better-auth.session_token";

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

const verifyAuth = async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const signedSessionToken = cookies[SESSION_COOKIE_NAME];

    if (!signedSessionToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const sessionToken = decodeURIComponent(signedSessionToken).split(".")[0];

    const session = await client.db().collection("session").findOne({
      token: sessionToken,
    });

    if (!session || new Date(session.expiresAt) <= new Date()) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await client.db().collection("user").findOne({
      _id: session.userId,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.session = {
      ...session,
      id: session._id,
    };
    req.user = {
      ...user,
      id: user._id,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

export default verifyAuth;
