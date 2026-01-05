# Coding Standards & Best Practices

This document outlines the coding standards and best practices followed in this project.

## 📁 Clean Folder Structure

```
Project 3/
├── backend/                    # Backend API server
│   ├── config/                 # Configuration files
│   │   └── database.js         # User storage (in-memory for demo)
│   ├── middleware/             # Express middleware
│   │   ├── auth.js            # JWT authentication
│   │   └── errorHandler.js    # Error handling
│   ├── routes/                 # API route handlers
│   │   ├── auth.js            # Authentication routes
│   │   ├── files.js           # File operation routes
│   │   └── notifications.js   # Notification routes
│   ├── services/               # Business logic services
│   │   ├── etcdService.js     # etcd metadata operations
│   │   └── minioService.js    # MinIO storage operations
│   ├── scripts/                # Utility scripts
│   │   └── initAdmin.js       # Admin password hash generator
│   ├── server.js              # Express server entry point
│   └── package.json           # Node.js dependencies
│
├── frontend/                   # React frontend application
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # React Context providers
│   │   ├── pages/             # Page components
│   │   ├── services/          # API client services
│   │   ├── App.js            # Main app component
│   │   └── index.js          # React entry point
│   └── package.json
│
├── docker-compose.yml          # Docker services orchestration
├── .gitignore                 # Git ignore rules
├── README.md                  # Project documentation
├── SETUP.md                   # Setup instructions
├── FEATURES.md                # Feature documentation
├── DISTRIBUTED_CONCEPTS.md    # Distributed systems concepts
└── CODING_STANDARDS.md        # This file
```

### Principles
- **Separation of Concerns**: Each folder has a clear purpose
- **Single Responsibility**: Each file handles one concern
- **Clear Naming**: Folder and file names are descriptive
- **Logical Grouping**: Related files are grouped together

## 💬 Clear Comments for Distributed System Decisions

All distributed system concepts are clearly documented with comments:

### Example Comment Style:
```javascript
/**
 * HIGH AVAILABILITY: Get file stream from nearest available replica
 * 
 * This function demonstrates High Availability by implementing automatic failover.
 * If one MinIO node fails, the system automatically tries the next available node.
 * 
 * @param {string} objectName - The object name/key in MinIO
 * @returns {Promise<{stream, nodeIndex, nodePort}>}
 */
```

### Comment Guidelines:
1. **Header Comments**: Each major function includes a header explaining the distributed concept
2. **Inline Comments**: Key distributed system decisions are explained inline
3. **Concept Tags**: Comments are tagged with concept names (HIGH AVAILABILITY, CONSISTENCY, etc.)
4. **Rationale**: Comments explain WHY, not just WHAT

## 🎯 No Overengineering

### Keep It Simple:
- ✅ **Simple patterns**: Use standard Express/React patterns
- ✅ **Clear abstractions**: Services are straightforward, no unnecessary layers
- ✅ **Practical solutions**: Choose solutions that work, not the most "clever"
- ✅ **Standard libraries**: Use well-known libraries (Express, React, etcd3, MinIO)

### Avoid:
- ❌ Complex design patterns (Factory, Strategy, etc.) unless necessary
- ❌ Over-abstraction with multiple layers
- ❌ Premature optimization
- ❌ Custom frameworks when standard tools work

## 📖 Beginner-Friendly Readability

### Code Style:
1. **Descriptive Variable Names**: `fileId` not `fid`, `userMetadata` not `umd`
2. **Clear Function Names**: `getFileMetadata()` not `getFM()`
3. **Small Functions**: Functions do one thing well
4. **Simple Logic**: Avoid nested ternaries, complex conditionals
5. **Consistent Formatting**: Use standard JavaScript formatting

### Example:
```javascript
// ✅ Good: Clear and readable
const handleFileUpload = async (file) => {
  const fileId = uuidv4();
  await uploadToStorage(file, fileId);
  await storeMetadata(fileId, file);
};

// ❌ Bad: Unclear and hard to read
const hfu = async (f) => {
  const fid = uuid();
  await uts(f, fid);
  await sm(fid, f);
};
```

### Structure:
- **Top to Bottom**: Main logic at top, helpers below
- **Early Returns**: Return early to reduce nesting
- **Error Handling**: Clear error messages

## 🔐 Environment Variables

All configuration uses environment variables:

### Backend (.env):
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# etcd Configuration
ETCD_HOST=localhost
ETCD_PORT=2379

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=distributed-files

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Guidelines:
1. **Never hardcode secrets**: All secrets use environment variables
2. **Provide defaults**: Use `process.env.VAR || 'default'` for optional config
3. **Document all vars**: Document in README/SETUP.md
4. **Example files**: Provide .env.example files (if not blocked)

## 🐳 Dockerized Services

All services run in Docker containers:

### Services:
- **etcd**: Metadata storage (Raft consensus)
- **MinIO**: Object storage (3-node distributed mode)

### docker-compose.yml:
- All services defined in docker-compose.yml
- Network isolation between services
- Volume persistence for data
- Health checks for services

### Benefits:
- **Consistency**: Same environment for all developers
- **Isolation**: Services don't conflict with local installs
- **Easy Setup**: `docker-compose up -d` starts everything
- **Portability**: Works on any system with Docker

## 📝 Code Documentation Standards

### Function Documentation:
```javascript
/**
 * Brief description of what the function does
 * 
 * Additional details if needed
 * Explains distributed system concept if applicable
 * 
 * @param {Type} paramName - Parameter description
 * @returns {Type} Return value description
 * @throws {Error} When this error occurs
 */
```

### Distributed System Comments:
- Always explain which concept is being demonstrated
- Explain WHY the approach was chosen
- Reference the concept in comments (HIGH AVAILABILITY, CONSISTENCY, etc.)

## ✅ Checklist for Code Review

When adding new code, ensure:
- [ ] Clear folder structure is maintained
- [ ] Distributed system concepts are explained in comments
- [ ] Code is simple and not over-engineered
- [ ] Variable and function names are descriptive
- [ ] Environment variables are used for configuration
- [ ] Docker services are used (not local installs)
- [ ] Comments explain WHY, not just WHAT
- [ ] Code follows existing patterns

## 🎓 Educational Focus

Remember: This is a **student project** demonstrating concepts, not a production system.

### Priorities:
1. **Clarity** over cleverness
2. **Demonstration** over optimization
3. **Learning** over complexity
4. **Readability** over brevity

### Good Practices:
- Write code that teaches
- Explain decisions in comments
- Use standard patterns students will recognize
- Keep it simple enough to understand
- Make it easy to modify and experiment


