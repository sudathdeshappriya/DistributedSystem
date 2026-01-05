// In-memory user storage (for demo purposes)
// In production, this would be a proper database
// Pre-hashed password for admin123 (bcrypt rounds=10)
// To regenerate: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(h => console.log(h));"
const ADMIN_PASSWORD_HASH = '$2a$10$XoTRxLREUI/icflBgZzkGepQQPVhVX7ef9wDeWLWlvdBmAa2djZ9O';

const users = [
  {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@example.com',
    password: ADMIN_PASSWORD_HASH, // password: admin123
    role: 'admin',
    createdAt: new Date().toISOString()
  }
];

// Helper functions for user operations
const userDB = {
  // Find user by username
  findByUsername: async (username) => {
    return users.find(u => u.username === username) || null;
  },

  // Find user by email
  findByEmail: async (email) => {
    return users.find(u => u.email === email) || null;
  },

  // Find user by ID
  findById: async (id) => {
    return users.find(u => u.id === id) || null;
  },

  // Create new user
  create: async (userData) => {
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
  },

  // Get all users (admin only)
  findAll: async () => {
    return users;
  }
};

module.exports = userDB;

