const bcrypt = require('bcryptjs');

// Generate hash for admin password: admin123
bcrypt.hash('admin123', 10).then(hash => {
  console.log('Admin password hash:', hash);
  console.log('Copy this hash to backend/config/database.js');
});


