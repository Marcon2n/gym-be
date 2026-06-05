const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const {
  updateMe,
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  registerMember
} = require('../controllers/gymController');

// Tuyến đường cập nhật thông tin cá nhân (Yêu cầu token)
router.put('/profile/update', verifyToken, updateMe);

// Tuyến đường CRUD Gói tập (Yêu cầu token chung để kiểm tra quyền nội bộ)
router.get('/packages', getAllPackages); // Xem tất cả - public để hiển thị trên trang đăng ký
router.get('/packages/:id', verifyToken, getPackageById); // Xem chi tiết
router.post('/packages', verifyToken, createPackage); // Thêm (Chỉ ADMIN)
router.put('/packages/:id', verifyToken, updatePackage); // Sửa (Chỉ ADMIN)
router.delete('/packages/:id', verifyToken, deletePackage); // Xóa (Chỉ ADMIN)
router.post('/members/register', registerMember);

module.exports = router;