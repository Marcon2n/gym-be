const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import các middleware của mình
const responseFormatter = require("./middlewares/responseMiddleware");
const errorHandler = require("./middlewares/errorMiddleware");
const authRoutes = require("./routes/authRoutes");

const app = express();

// 1. Cấu hình các middleware cơ bản hệ thống
app.use(cors());
app.use(express.json());

// 2. Gắn Middleware bọc format dữ liệu trả về (Đặt TRƯỚC router)
app.use(responseFormatter);

// 3. Đăng ký các tuyến đường API
app.use("/api/auth", authRoutes);

// 4. Gắn Middleware xử lý Exception tập trung (BẮT BUỘC đặt cuối cùng, SAU các router)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy ngon lành tại cổng: ${PORT}`);
});
