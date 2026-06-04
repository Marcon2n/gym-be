const errorHandler = (err, req, res, next) => {
  console.error("❌ [HỆ THỐNG BÁO LỖI]:", err.stack || err.message || err);

  // Xác định status code (Mặc định là 500 nếu lỗi hệ thống không xác định)
  const statusCode =
    err.statusCode || res.statusCode >= 400 ? res.statusCode : 500;

  // Định dạng cấu trúc lỗi đồng bộ với responseMiddleware
  const errorResponse = {
    success: false,
    statusCode: statusCode,
    message: err.message || "Đã xảy ra lỗi hệ thống nghiêm trọng!",
    data: null,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR", // Mã lỗi để Front-end check (ví dụ: NEED_CHANGE_PASSWORD)
      details: err.details || err.message || null,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
