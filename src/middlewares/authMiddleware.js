const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ details: "Không tìm thấy token truy cập!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Nếu token có cờ ép đổi mật khẩu, chặn lại không cho gọi API khác ngoại trừ change-password
    if (decoded.requireChangePass && req.path !== '/change-password') {
      return res.status(403).json({ 
        code: "NEED_CHANGE_PASSWORD",
        details: "Tài khoản bắt buộc phải đổi mật khẩu mặc định trước!" 
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ details: "Token đã hết hạn hoặc không hợp lệ!" });
  }
};

module.exports = { verifyToken };