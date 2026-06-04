const express = require('express');
const { 
  login, 
  forceChangePassword, 
  resetPasswordByAdmin, 
  activeChangePassword, 
  getMe, 
  logout 
} = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// --- Tuyến đường KHÔNG cần đăng nhập ---
router.post('/login', login);

// --- Tuyến đường BẮT BUỘC phải đính kèm Token ở Header ---
router.post('/change-password', verifyToken, forceChangePassword); // Ép đổi pass mặc định khi bị reset
router.post('/profile/change-password', verifyToken, activeChangePassword); // Đổi pass chủ động khi đang xài app
router.get('/me', verifyToken, getMe); // Lấy hồ sơ tài khoản hiện tại khi reload ứng dụng
router.post('/logout', verifyToken, logout); // Đăng xuất

// API "Reset bằng cơm" của Admin/Lễ tân (Cần verifyToken để lọc quyền xem ai đang bấm nút)
router.post('/reset-password-by-admin', verifyToken, resetPasswordByAdmin);

module.exports = router;