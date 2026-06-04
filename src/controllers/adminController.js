const pool = require('../config/database');
const bcrypt = require('bcrypt');

// API: Chỉ ADMIN tối cao mới tạo được Nhân viên mới (PT, Lễ tân, Admin khác)
const adminCreateStaff = async (req, res, next) => {
  const { username, password, name, phone, role } = req.body;
  const creatorRole = req.user.role; // Lấy từ token của người đang gọi API

  // BẢO MẬT: Kiểm tra nếu kẻ đang bấm nút KHÔNG PHẢI là Admin thì đập chết request ngay
  if (creatorRole !== 'ADMIN') {
    const error = new Error("Từ chối truy cập! Chỉ có quyền ADMIN tối cao mới được phép tạo nhân viên.");
    error.statusCode = 403;
    error.code = "FORBIDDEN_ACCESS";
    return next(error);
  }

  try {
    // 1. Kiểm tra xem username định tạo đã tồn tại trong bảng staffs chưa
    const checkUsername = await pool.query('SELECT id FROM staffs WHERE username = $1', [username]);
    if (checkUsername.rows.length > 0) {
      const error = new Error("Tên đăng nhập (username) này đã tồn tại trên hệ thống!");
      error.statusCode = 400;
      return next(error);
    }

    // 2. Kiểm tra xem role truyền lên có hợp lệ không (Phòng gym chỉ có 3 role nhân sự này)
    const validRoles = ['ADMIN', 'PT', 'RECEPTIONIST'];
    if (!validRoles.includes(role)) {
      const error = new Error("Vai trò nhân viên không hợp lệ! (Phải là ADMIN, PT hoặc RECEPTIONIST)");
      error.statusCode = 400;
      return next(error);
    }

    // 3. Xử lý mật khẩu: Nếu Admin để trống ô nhập thì tự gán '123456' để kích hoạt luồng đổi pass lần đầu
    const finalPassword = password || '123456';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // 4. Tiến hành chèn dữ liệu vào bảng staffs dưới PostgreSQL
    const result = await pool.query(
      `INSERT INTO staffs (username, password, name, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, username, name, role, is_active, created_at`,
      [username, hashedPassword, name, phone, role]
    );

    // 5. Phản hồi thành công
    return res.status(201).json({
      message: password 
        ? "Tạo tài khoản nhân viên mới thành công!" 
        : "Tạo tài khoản nhân viên thành công với mật khẩu mặc định 123456.",
      staff: result.rows[0]
    });

  } catch (error) {
    return next(error); // Đẩy lỗi về errorMiddleware tự lo bọc JSON
  }
};

const adminGetAllStaffs = async (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    const error = new Error("Từ chối truy cập! Chức năng này chỉ dành cho Admin.");
    error.statusCode = 403;
    return next(error);
  }

  try {
    // Lấy hết nhân viên lên, sắp xếp theo ngày tạo mới nhất (Không trả về mật khẩu để bảo mật)
    const result = await pool.query(
      'SELECT id, username, name, phone, role, is_active, created_at FROM staffs ORDER BY id DESC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
};

// 3. READ: Xem chi tiết 1 nhân viên theo ID (Chỉ ADMIN)
const adminGetStaffById = async (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    const error = new Error("Từ chối truy cập!");
    error.statusCode = 403;
    return next(error);
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, username, name, phone, role, is_active, created_at FROM staffs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const error = new Error("Không tìm thấy nhân viên này!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

// 4. UPDATE: Chỉnh sửa thông tin nhân viên (Chỉ ADMIN)
const adminUpdateStaff = async (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    const error = new Error("Từ chối truy cập!");
    error.statusCode = 403;
    return next(error);
  }

  const { id } = req.params;
  const { name, phone, role, is_active } = req.body;

  try {
    // Kiểm tra role hợp lệ nếu có thay đổi
    if (role) {
      const validRoles = ['ADMIN', 'PT', 'RECEPTIONIST'];
      if (!validRoles.includes(role)) {
        const error = new Error("Vai trò không hợp lệ!");
        error.statusCode = 400;
        return next(error);
      }
    }

    const result = await pool.query(
      `UPDATE staffs 
       SET name = COALESCE($1, name), 
           phone = COALESCE($2, phone), 
           role = COALESCE($3, role), 
           is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING id, username, name, phone, role, is_active`,
      [name, phone, role, is_active, id]
    );

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy nhân viên để cập nhật!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({
      message: "Cập nhật thông tin nhân viên thành công!",
      staff: result.rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

// 5. DELETE: Xóa nhân viên khỏi hệ thống (Chỉ ADMIN)
const adminDeleteStaff = async (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    const error = new Error("Từ chối truy cập!");
    error.statusCode = 403;
    return next(error);
  }

  const { id } = req.params;

  // Tự vệ hệ thống: ADMIN không được tự khóa chính mình
  if (parseInt(id) === req.user.id) {
    const error = new Error("Bạn không thể tự khóa tài khoản Admin chính mình đang sử dụng!");
    error.statusCode = 400;
    return next(error);
  }

  try {
    // THAY VÌ DELETE: Chúng ta UPDATE trạng thái is_active = false (Đánh dấu xóa/nghỉ việc)
    const result = await pool.query(
      'UPDATE staffs SET is_active = false WHERE id = $1 RETURNING id, username, is_active',
      [id]
    );

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy nhân viên này trên hệ thống!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({ 
      message: "Đã xóa mềm thành công! Tài khoản nhân viên đã bị vô hiệu hóa và chuyển sang trạng thái nghỉ việc." 
    });

  } catch (error) {
    return next(error);
  }
};

// =========================================================================
// IV. PHÂN HỆ: QUẢN LÝ HỘI VIÊN (MEMBERS) DÀNH CHO ADMIN & LỄ TÂN
// =========================================================================

// 1. READ: Lấy danh sách toàn bộ hội viên (Cả Admin và Lễ tân đều dùng được)
const adminGetAllMembers = async (req, res, next) => {
  const { role } = req.user;
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') {
    const error = new Error("Từ chối truy cập! Chức năng này chỉ dành cho nhân viên.");
    error.statusCode = 403;
    return next(error);
  }

  try {
    // Lấy thông tin từ View địa chính hôm trước làm (v_member_profiles) cho đầy đủ tỉnh/phường
    // Sắp xếp theo ID giảm dần để ông nào mới đăng ký nhảy lên đầu bảng
    const result = await pool.query(
      'SELECT id, name, phone, gender, birthday, status, province_name, ward_name, created_at FROM v_member_profiles ORDER BY id DESC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return next(error);
  }
};

// 2. READ: Xem chi tiết hồ sơ của 1 hội viên theo ID
const adminGetMemberById = async (req, res, next) => {
  const { role } = req.user;
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') {
    const error = new Error("Từ chối truy cập!");
    error.statusCode = 403;
    return next(error);
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, name, phone, gender, birthday, status, province_name, ward_name, created_at FROM v_member_profiles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      const error = new Error("Không tìm thấy hội viên này trên hệ thống!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
};

// 3. DELETE (Soft Delete): Vô hiệu hóa / Khóa tài khoản hội viên
const adminDeactivateMember = async (req, res, next) => {
  const { role } = req.user;
  // Quyền lực tối cao: Tính năng khóa tài khoản khách nên để ADMIN hoặc RECEPTIONIST xử lý
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') {
    const error = new Error("Bạn không có quyền vô hiệu hóa tài khoản hội viên!");
    error.statusCode = 403;
    return next(error);
  }

  const { id } = req.params;

  try {
    // Đánh dấu xóa mềm bằng cách chuyển status về -1 (Ví dụ quy ước: 0: Active, 1: Pending, -1: Bị khóa/Xóa mềm)
    const result = await pool.query(
      'UPDATE members SET status = -1 WHERE id = $1 RETURNING id, name, phone, status',
      [id]
    );

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy hội viên để vô hiệu hóa!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({
      message: "Đã vô hiệu hóa (khóa mềm) tài khoản hội viên thành công! Khách hàng này sẽ không thể đăng nhập hoặc check-in.",
      member: result.rows[0]
    });
  } catch (error) {
    return next(error);
  }
};

// Xuất tất cả các hàm ra ngoài
module.exports = {
  adminCreateStaff,
  adminGetAllStaffs,
  adminGetStaffById,
  adminUpdateStaff,
  adminDeleteStaff,
  adminGetAllMembers,
  adminGetMemberById,
  adminDeactivateMember
};