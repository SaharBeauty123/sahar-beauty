const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  const jwtSecret = process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'development-only-secret');

  if (!jwtSecret) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Not authorized" });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.adminId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
