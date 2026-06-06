const { Pool } = require("pg");
require("dotenv").config();

// Mã hóa các ký tự đặc biệt của mật khẩu để nhét vào URL an toàn
const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD);

const pool = new Pool({
  // 🚨 ÉP CỨNG CHUỖI KẾT NỐI KÈM OPTIONS SEARCH_PATH TRỰC TIẾP QUA MẠNG
  connectionString: `postgresql://${process.env.DB_USER}:${encodedPassword}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?options=-c%20search_path%3Dgym_management,public`,
});

// Test kiểm tra kết nối ban đầu cực kỳ đơn giản
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Lỗi kết nối PostgreSQL:", err);
  } else {
    console.log(
      "✅ Kết nối PostgreSQL thành công! Đã ép cứng schema ở tầng mạng.",
    );
  }
});

module.exports = pool;
