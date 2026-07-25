const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const jwtSecret = process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'development-only-secret');

  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured' });
  }

  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(400).json({ error: "Invalid credentials" });

  const match = await admin.comparePassword(password);
  if (!match) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: admin._id }, jwtSecret);

  res.json({ token });
};

exports.createAdmin = async () => {
  const username = process.env.ADMIN_USERNAME
    || (process.env.NODE_ENV === 'production' ? '' : 'owner');
  const password = process.env.ADMIN_PASSWORD
    || (process.env.NODE_ENV === 'production' ? '' : '123456');

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
  }

  const exists = await Admin.findOne({ username });
  if (!exists) {
    await Admin.create({
      username,
      password
    });
    console.log(`✅ Admin account created for ${username}`);
  }
};
