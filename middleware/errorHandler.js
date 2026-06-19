const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;
  const message =
    statusCode >= 500 ? "Internal server error" : error.message || "Request failed";

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
