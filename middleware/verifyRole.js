const ALLOWED_ROLES = ["user", "creator", "admin"];

const verifyRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    next();
  };
};

export { ALLOWED_ROLES };
export default verifyRole;
