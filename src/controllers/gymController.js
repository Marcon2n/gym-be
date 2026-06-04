const pool = require('../config/database');
const bcrypt = require('bcrypt');

// =========================================================================
// I. PHÂN HỆ: CẬP NHẬT THÔNG TIN CÁ NHÂN (MỌI ROLE TỰ UPDATE CHÍNH MÌNH)
// =========================================================================
const updateMe = async (req, res, next) => {
  const { id, role } = req.user; // Lấy từ Token đã verify
  const { name, phone, gender, birthday, province_code, ward_code } = req.body;

  try {
    let result;

    if (role === 'MEMBER') {
      // Cập nhật bảng hội viên
      result = await pool.query(
        `UPDATE members 
         SET name = $1, phone = $2, gender = $3, birthday = $4, province_code = $5, ward_code = $6
         WHERE id = $7`,
        [name, phone, gender, birthday, province_code, ward_code, id]
      );
    } else {
      // Cập nhật bảng nhân viên (ADMIN, PT, RECEPTIONIST)
      result = await pool.query(
        `UPDATE staffs 
         SET name = $1, phone = $2, province_code = $3, ward_code = $4
         WHERE id = $5`,
        [name, phone, province_code, ward_code, id]
      );
    }

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy thông tin tài khoản để cập nhật!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({ message: "Cập nhật hồ sơ cá nhân thành công!" });
  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// II. PHÂN HỆ: CRUD GÓI TẬP (GYM PACKAGES) - DÀNH CHO ADMIN
// =========================================================================

// 1. LẤY DANH SÁCH GÓI TẬP (Mọi role đều có quyền xem)
const getAllPackages = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM gym_packages ORDER BY id DESC');
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
};

// 2. CHI TIẾT MỘT GÓI TẬP
const getPackageById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM gym_packages WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      const error = new Error("Gói tập không tồn tại!");
      error.statusCode = 404;
      return next(error);
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

// 3. THÊM GÓI TẬP MỚI (CHỈ ADMIN)
const createPackage = async (req, res, next) => {
  const { name, duration_months, price, description } = req.body;
  const { role } = req.user;

  // Kiểm tra quyền ADMIN gắt gao ở tầng Controller
  if (role !== 'ADMIN') {
    const error = new Error("Chỉ có Admin mới có quyền tạo gói tập!");
    error.statusCode = 403;
    return next(error);
  }

  try {
    const result = await pool.query(
      `INSERT INTO gym_packages (name, duration_months, price, description) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, duration_months, price, description]
    );
    return res.status(201).json({
      message: "Tạo gói tập mới thành công!",
      package: result.rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

// 4. SỬA GÓI TẬP (CHỈ ADMIN)
const updatePackage = async (req, res, next) => {
  const { id } = req.params;
  const { name, duration_months, price, description } = req.body;
  const { role } = req.user;

  if (role !== 'ADMIN') {
    const error = new Error("Chỉ có Admin mới có quyền chỉnh sửa gói tập!");
    error.statusCode = 403;
    return next(error);
  }

  try {
    const result = await pool.query(
      `UPDATE gym_packages 
       SET name = $1, duration_months = $2, price = $3, description = $4
       WHERE id = $5 RETURNING *`,
      [name, duration_months, price, description, id]
    );

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy gói tập để cập nhật!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({
      message: "Cập nhật gói tập thành công!",
      package: result.rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

// 5. XÓA GÓI TẬP (CHỈ ADMIN)
const deletePackage = async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.user;

  if (role !== 'ADMIN') {
    const error = new Error("Chỉ có Admin mới có quyền xóa gói tập!");
    error.statusCode = 403;
    return next(error);
  }

  try {
    const result = await pool.query('DELETE FROM gym_packages WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy gói tập để xóa!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({ message: "Xóa gói tập thành công!" });
  } catch (error) {
    // Trường hợp gói tập đã có hội viên mua, Postgres sẽ chặn lại do ràng buộc khóa ngoại (Foreign Key)
    if (error.code === '23503') {
      const customError = new Error("Không thể xóa gói tập này vì đã có dữ liệu hội viên đăng ký sử dụng!");
      customError.statusCode = 400;
      return next(customError);
    }
    return next(error);
  }
};

// =========================================================================
// III. PHÂN HỆ: TẠO TÀI KHOẢN HỘI VIÊN (CHỈ CHECK MÃ THANH TOÁN - KHÔNG TOKEN)
// =========================================================================
const registerMember = async (req, res, next) => {
  const { name, phone, password, gender, birthday, province_code, ward_code, transaction_code } = req.body;

  try {
    // 1. Kiểm tra xem số điện thoại đã tồn tại chưa
    const checkPhone = await pool.query('SELECT id FROM members WHERE phone = $1', [phone]);
    if (checkPhone.rows.length > 0) {
      const error = new Error("Số điện thoại này đã được đăng ký tài khoản!");
      error.statusCode = 400;
      return next(error);
    }

    // 2. BẮT BUỘC PHẢI CÓ MÃ THANH TOÁN (Khách tự sinh từ FE gửi lên, Lễ tân cũng gõ bừa một mã vào)
    if (!transaction_code || transaction_code.trim() === '') {
      const error = new Error("Thao tác thất bại! Yêu cầu phải có mã xác thực thanh toán (Transaction Code).");
      error.statusCode = 400;
      return next(error);
    }

    // 3. Mật khẩu: Nếu Lễ tân tạo hộ để trống thì tự gán '123456', còn khách ở nhà tự điền thì lấy pass của khách
    const finalPassword = password || '123456';

    // Mã hóa mật khẩu bảo mật
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // 4. Chèn trực tiếp vào PostgreSQL và kích hoạt tài khoản luôn (status = 0)
    const newMember = await pool.query(
      `INSERT INTO members (name, phone, password, gender, birthday, province_code, ward_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0) RETURNING id, name, phone, status, created_at`,
      [name, phone, hashedPassword, gender, birthday, province_code, ward_code]
    );

    // 5. Trả response chuẩn về cho Client
    return res.status(201).json({
      message: `Xác thực mã giao dịch ${transaction_code} thành công! Tài khoản hội viên đã được kích hoạt.`,
      member: newMember.rows[0]
    });

  } catch (error) {
    return next(error); // Lỗi hệ thống đẩy về errorMiddleware bọc JSON
  }
};

module.exports = {
  updateMe,
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  registerMember
};