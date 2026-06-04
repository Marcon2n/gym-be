const express = require('express');
const cors = require('cors');
const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const responseFormatter = require('./middlewares/responseMiddleware');
const authRoutes = require('./routes/authRoutes');
const gymRoutes = require('./routes/gymRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Đọc cấu hình Swagger
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

// Cấu hình Middleware toàn cục
app.use(cors());
app.use(express.json());
app.use(responseFormatter); // Tự động bọc mọi response trả về theo dạng chuẩn

// Router cho tài liệu API Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Đăng ký các Route API chính thức
app.use('/api/auth', authRoutes);
app.use('/api/gym', gymRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang khởi chạy tại cổng: ${PORT}`);
  console.log(`📝 Xem tài liệu API Swagger tại: http://localhost:${PORT}/api-docs`);
});