const jwt = require('jsonwebtoken');
const userDB = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production');
    const user = await userDB.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    res.status(500).json({ error: 'Authentication error.' });
  }
};

// Check if user is admin
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// Optional: Check if user is owner or admin
const authorizeOwnerOrAdmin = (ownerId) => {
  return (req, res, next) => {
    if (req.user.role === 'admin' || req.user.id === ownerId) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied. You do not have permission.' });
  };
};

module.exports = {
  authenticate,
  authorizeAdmin,
  authorizeOwnerOrAdmin
};


