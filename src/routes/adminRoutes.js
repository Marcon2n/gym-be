const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { 
  adminCreateStaff, 
  adminGetAllStaffs, 
  adminGetStaffById, 
  adminUpdateStaff, 
  adminDeleteStaff,
  adminGetAllMembers,
  adminGetMemberById,
  adminDeactivateMember
} = require('../controllers/adminController');

// Đóng gói trọn bộ CRUD Staff phục vụ Admin
router.post('/create-staff', verifyToken, adminCreateStaff);      // Tạo mới
router.get('/staffs', verifyToken, adminGetAllStaffs);           // Lấy danh sách
router.get('/staffs/:id', verifyToken, adminGetStaffById);       // Xem chi tiết một ông
router.put('/staffs/:id', verifyToken, adminUpdateStaff);         // Chỉnh sửa thông tin
router.delete('/staffs/:id', verifyToken, adminDeleteStaff);      // Xóa tài khoản
router.get('/members', verifyToken, adminGetAllMembers);         // Xem danh sách toàn bộ khách
router.get('/members/:id', verifyToken, adminGetMemberById);     // Xem chi tiết 1 khách
router.delete('/members/:id', verifyToken, adminDeactivateMember); // Khóa mềm tài khoản khách

module.exports = router;