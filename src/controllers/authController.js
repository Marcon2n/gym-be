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
        { id: user.id, role: type, requireChangePass: true },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      
      return res.status(403).json({
        code: "NEED_CHANGE_PASSWORD",
        temporaryToken: tempToken
      });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: type, requireChangePass: false },
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

    if (role === 'member') {
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

module.exports = { login, forceChangePassword };