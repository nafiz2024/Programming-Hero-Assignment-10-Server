import { authenticateRequest } from "./verifyAuth.js";

const verifyAdminSession = async (req, res, next) => {
  try {
    const authData = await authenticateRequest(req);

    if (!authData?.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    req.session = authData.session;
    req.user = authData.user;

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

export default verifyAdminSession;
