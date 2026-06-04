const responseFormatter = (req, res, next) => {
  // Lưu lại hàm res.json gốc của Express để gọi lại ở cuối
  const originalJson = res.json;

  // Định nghĩa lại (override) hàm res.json
  res.json = function (data) {
    // Nếu dữ liệu truyền vào đã có trường 'success' (nghĩa là đã qua hàm xử lý lỗi hoặc được format tay) thì cho qua luôn
    if (data && data.hasOwnProperty("success")) {
      return originalJson.call(this, data);
    }

    // Tự động kiểm tra HTTP Status Code để quyết định success là true hay false
    // Các mã dạng 2xx (200, 201...) là thành công
    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;

    const formattedResponse = {
      success: isSuccess,
      statusCode: res.statusCode,
      message: isSuccess ? "Thao tác thành công" : "Đã xảy ra lỗi",
      data: isSuccess ? data || null : null,
      error: isSuccess ? null : data || null,
      timestamp: new Date().toISOString(),
    };

    // Gọi hàm json gốc để trả dữ liệu thực tế về Client
    return originalJson.call(this, formattedResponse);
  };

  next();
};

module.exports = responseFormatter;
