const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { username_or_phone, password, type } = req.body;

  try {
    let user = null;
    
    if (type === 'member') {
      const result = await pool.query('SELECT * FROM members WHERE phone = $1', [username_or_phone]);
      user = result.rows[0];
    } else if (type === 'staff') {
      const result = await pool.query('SELECT * FROM staffs WHERE username = $1', [username_or_phone]);
      user = result.rows[0];
    } else {
      return res.status(400).json({ details: "Loại tài khoản không hợp lệ (Phải là 'member' hoặc 'staff')!" });
    }

    if (!user) {
      return res.status(401).json({ details: "Tài khoản không chính xác!" });
    }

    if (type === 'member' && user.status === -1) {
      return res.status(403).json({ details: "Tài khoản hội viên này đã bị khóa!" });
    }
    if (type === 'staff' && !user.is_active) {
      return res.status(403).json({ details: "Tài khoản nhân viên này đã nghỉ việc!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ details: "Mật khẩu không chính xác!" });
    }

    // Kiểm tra xem mật khẩu người dùng gõ vào có trùng chuỗi mặc định '123456' hay không
    const isDefaultPassword = password === '123456'; 

    if (isDefaultPassword) {
      const tempToken = jwt.sign(
        { id: user.id, role: type === 'staff' ? user.role : 'MEMBER', requireChangePass: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      
      return res.status(403).json({
        code: "NEED_CHANGE_PASSWORD",
        temporaryToken: tempToken
      });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: type === 'staff' ? user.role : 'MEMBER', requireChangePass: false },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      accessToken: accessToken,
      role: type === 'staff' ? user.role : 'MEMBER',
      name: user.name
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ details: "Lỗi hệ thống trong quá trình đăng nhập!" });
  }
};

const forceChangePassword = async (req, res) => {
  const { new_password } = req.body;
  const { id, role } = req.user;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(new_password, salt);

    if (role === 'MEMBER') {
      await pool.query('UPDATE members SET password = $1 WHERE id = $2', [hashedPass, id]);
    } else {
      await pool.query('UPDATE staffs SET password = $1 WHERE id = $2', [hashedPass, id]);
    }

    const newAccessToken = jwt.sign(
      { id: id, role: role, requireChangePass: false },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      message: "Đổi mật khẩu thành công!",
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ details: "Lỗi hệ thống khi cập nhật mật khẩu!" });
  }
};

const resetPasswordByAdmin = async (req, res, next) => {
  const { userId, type } = req.body;
  const adminRole = req.user.role; // Lấy từ token của người đang thực hiện lệnh

  try {
    // Phân quyền nâng cao: Chỉ ADMIN và RECEPTIONIST mới được dùng tính năng này
    if (adminRole !== 'ADMIN' && adminRole !== 'RECEPTIONIST') {
      const error = new Error("Bạn không có quyền thực hiện chức năng này!");
      error.statusCode = 403;
      error.code = "FORBIDDEN_ACCESS";
      return next(error);
    }

    // Nhân viên Lễ tân thì không được phép reset mật khẩu của nhân viên khác (hoặc Admin)
    if (adminRole === 'RECEPTIONIST' && type === 'staff') {
      const error = new Error("Lễ tân chỉ có quyền reset mật khẩu cho Hội viên!");
      error.statusCode = 403;
      error.code = "FORBIDDEN_ACCESS";
      return next(error);
    }

    // Mã hóa mật khẩu mặc định '123456'
    const salt = await bcrypt.genSalt(10);
    const hashedDefaultPass = await bcrypt.hash('123456', salt);

    let result;
    if (type === 'member') {
      result = await pool.query('UPDATE members SET password = $1 WHERE id = $2', [hashedDefaultPass, userId]);
    } else if (type === 'staff') {
      result = await pool.query('UPDATE staffs SET password = $1 WHERE id = $2', [hashedDefaultPass, userId]);
    } else {
      const error = new Error("Loại tài khoản cần reset không hợp lệ!");
      error.statusCode = 400;
      return next(error);
    }

    if (result.rowCount === 0) {
      const error = new Error("Không tìm thấy người dùng có ID này trong hệ thống!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({
      message: `Đã reset mật khẩu của người dùng về '123456' thành công.`
    });

  } catch (error) {
    return next(error); // Đẩy lỗi về errorMiddleware tự lo
  }
};

// 2. API: Tự đổi mật khẩu chủ động khi đang trong ứng dụng
const activeChangePassword = async (req, res, next) => {
  const { old_password, new_password } = req.body;
  const { id, role } = req.user; // Lấy từ token giải mã qua Middleware

  try {
    let userQuery;
    if (role === 'MEMBER') {
      userQuery = await pool.query('SELECT password FROM members WHERE id = $1', [id]);
    } else {
      // Nếu role là ADMIN, PT, RECEPTIONIST thì đều nằm trong bảng staffs
      userQuery = await pool.query('SELECT password FROM staffs WHERE id = $1', [id]);
    }

    const user = userQuery.rows[0];
    if (!user) {
      const error = new Error("Không tìm thấy thông tin tài khoản!");
      error.statusCode = 404;
      return next(error);
    }

    // So sánh mật khẩu cũ người dùng nhập với mật khẩu mã hóa trong DB
    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      const error = new Error("Mật khẩu cũ không chính xác!");
      error.statusCode = 400;
      error.code = "WRONG_OLD_PASSWORD";
      return next(error);
    }

    // Mã băm mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedNewPass = await bcrypt.hash(new_password, salt);

    if (role === 'MEMBER') {
      await pool.query('UPDATE members SET password = $1 WHERE id = $2', [hashedNewPass, id]);
    } else {
      await pool.query('UPDATE staffs SET password = $1 WHERE id = $2', [hashedNewPass, id]);
    }

    return res.status(200).json({
      message: "Đổi mật khẩu mới thành công!"
    });

  } catch (error) {
    return next(error);
  }
};

// 3. API: Lấy thông tin tài khoản hiện tại (Tận dụng View địa chính hôm trước làm)
const getMe = async (req, res, next) => {
  const { id, role } = req.user;

  try {
    let userResult;

    if (role === 'MEMBER') {
      // Chọc thẳng vào View thông tin hội viên đã JOIN tỉnh/phường
      userResult = await pool.query('SELECT id, name, phone, gender, dob, status, created_at FROM v_member_profiles WHERE id = $1', [id]);
    } else {
      // Chọc vào View nhân viên (ADMIN, PT, RECEPTIONIST)
      userResult = await pool.query('SELECT id, name, username, phone, role, is_active, province_name, ward_name, created_at FROM v_staff_profiles WHERE id = $1', [id]);
    }

    const userData = userResult.rows[0];
    if (!userData) {
      const error = new Error("Không tìm thấy dữ liệu hồ sơ!");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json(userData);

  } catch (error) {
    return next(error);
  }
};

// 4. API: Đăng xuất hệ thống (Phía Backend)
const logout = async (req, res, next) => {
  try {
    // Với JWT stateless, phía FE xóa token là chính. 
    // Trả về thành công để FE biết đường điều hướng về trang Login.
    return res.status(200).json({
      message: "Đăng xuất tài khoản thành công."
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { 
  login, 
  forceChangePassword, 
  resetPasswordByAdmin, 
  activeChangePassword, 
  getMe, 
  logout 
};