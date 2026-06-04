// seed.js
const pool = require('./src/config/database'); // Đường dẫn tới file cấu hình DB của bạn
const bcrypt = require('bcrypt');

const seedAdmin = async () => {
  try {
    console.log("🔄 Đang băm mật khẩu bằng bcrypt trên máy của bạn...");
    
    // 1. Sinh salt và băm mật khẩu 'admin123' trực tiếp bằng môi trường Node của bạn
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    console.log(`🔑 Chuỗi hash sinh ra là: ${hashedPassword}`);
    console.log(`📏 Độ dài chuỗi hash: ${hashedPassword.length} ký tự`);

    // 2. Chọc thẳng xuống DB cập nhật đè lên tài khoản admin
    const result = await pool.query(
      "UPDATE staffs SET password = $1 WHERE username = 'admin' RETURNING id, username", 
      [hashedPassword]
    );

    if (result.rowCount === 0) {
      console.log("❌ Thất bại: Không tìm thấy tài khoản nào có username là 'admin' dưới DB để update!");
    } else {
      console.log("✅ THÀNH CÔNG! Đã cập nhật mật khẩu admin chuẩn 100%!");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi hệ thống:", error);
    process.exit(1);
  }
};

seedAdmin();