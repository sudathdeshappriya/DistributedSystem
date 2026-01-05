# Project Structure Guide

This document explains the project structure and where to find things.

## 📂 Root Directory

```
Project 3/
├── backend/              # Backend API server
├── frontend/             # React frontend
├── docker-compose.yml    # Docker services configuration
├── .gitignore           # Files to ignore in git
└── Documentation files   # README, SETUP, etc.
```

## 🔧 Backend Structure

### `/backend`
The backend is a Node.js Express API server.

```
backend/
├── config/
│   └── database.js       # User storage (simple in-memory for demo)
│
├── middleware/
│   ├── auth.js          # JWT authentication middleware
│   └── errorHandler.js  # Global error handling
│
├── routes/
│   ├── auth.js          # /api/auth/* endpoints
│   ├── files.js         # /api/files/* endpoints
│   └── notifications.js # /api/notifications/* endpoints
│
├── services/
│   ├── etcdService.js   # etcd operations (metadata)
│   └── minioService.js  # MinIO operations (file storage)
│
├── scripts/
│   └── initAdmin.js     # Helper script (optional)
│
├── server.js            # Main entry point - starts Express server
└── package.json         # Dependencies
```

### Key Files Explained:

**server.js**
- Entry point of the backend
- Initializes Express app
- Connects to etcd and MinIO
- Sets up routes and middleware
- Starts the server

**routes/auth.js**
- User registration
- User login
- JWT token generation
- User profile endpoints

**routes/files.js**
- File upload
- File download (with replica selection)
- File delete (from all replicas)
- File listing
- File info

**routes/notifications.js**
- List notifications
- Mark as read
- Delete notifications
- Unread count

**services/etcdService.js**
- Connects to etcd
- Stores/retrieves file metadata
- Stores/retrieves notifications
- Uses Raft consensus (automatic in etcd)

**services/minioService.js**
- Connects to MinIO
- Uploads files (replicated automatically)
- Downloads from replicas (failover)
- Deletes from all replicas
- Checks storage locations

**config/database.js**
- Simple in-memory user storage
- In production, replace with real database
- Stores: username, email, password hash, role

## 🎨 Frontend Structure

### `/frontend`
The frontend is a React application with Tailwind CSS.

```
frontend/
├── public/
│   └── index.html       # HTML template
│
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── FileCard.js      # File card display
│   │   ├── FileList.js      # File list grid
│   │   ├── FileUpload.js    # File upload form
│   │   ├── Navbar.js        # Navigation bar
│   │   ├── NotificationPanel.js # Toast notifications
│   │   └── PrivateRoute.js  # Protected routes
│   │
│   ├── context/         # React Context (global state)
│   │   ├── AuthContext.js        # User authentication state
│   │   └── NotificationContext.js # Notification state
│   │
│   ├── pages/           # Page components
│   │   ├── Login.js          # Login page
│   │   ├── Register.js       # Registration page
│   │   └── Dashboard.js      # Main dashboard
│   │
│   ├── services/
│   │   └── api.js       # Axios API client
│   │
│   ├── App.js           # Main app component (routing)
│   ├── index.js         # React entry point
│   └── index.css        # Global styles + Tailwind
│
├── tailwind.config.js   # Tailwind CSS configuration
└── package.json         # Dependencies
```

### Key Files Explained:

**App.js**
- Sets up React Router
- Defines routes (login, register, dashboard)
- Wraps app with context providers

**pages/Dashboard.js**
- Main file management interface
- Shows stats, upload form, file list
- Handles file operations

**components/FileCard.js**
- Displays single file as a card
- Shows file icon, name, size, date
- Download and delete buttons

**components/FileList.js**
- Grid layout of FileCard components
- Responsive (1-4 columns based on screen size)
- Loading and empty states

**components/FileUpload.js**
- File selection (drag & drop)
- Upload progress bar
- Upload button

**context/AuthContext.js**
- Manages user authentication state
- Login/logout functions
- JWT token management

**services/api.js**
- Axios instance configured for backend API
- Automatically adds JWT token to requests
- Base URL from environment variable

## 🐳 Docker Structure

### `docker-compose.yml`
Defines all services in one file:

```yaml
services:
  etcd:          # Metadata storage
  minio1:        # MinIO node 1
  minio2:        # MinIO node 2
  minio3:        # MinIO node 3
```

### Service Details:

**etcd**
- Port: 2379 (client), 2380 (peer)
- Stores: File metadata, notifications
- Protocol: Raft consensus

**MinIO (3 nodes)**
- Node 1: Ports 9001 (API), 9002 (Console)
- Node 2: Ports 9003 (API), 9004 (Console)
- Node 3: Ports 9005 (API), 9006 (Console)
- Stores: Actual file data
- Mode: Distributed (automatic replication)

## 📝 Environment Variables

### Backend `.env` (in `/backend` folder):
```env
PORT=5000
JWT_SECRET=...
ETCD_HOST=localhost
ETCD_PORT=2379
MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=distributed-files
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env` (in `/frontend` folder):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 🔍 Where to Find Things

### Want to add a new API endpoint?
→ `backend/routes/` (create new file or add to existing)

### Want to change file upload logic?
→ `backend/routes/files.js` (upload endpoint)
→ `backend/services/minioService.js` (storage operations)

### Want to change UI components?
→ `frontend/src/components/` (reusable components)
→ `frontend/src/pages/` (page components)

### Want to change styling?
→ `frontend/tailwind.config.js` (Tailwind config)
→ `frontend/src/index.css` (global styles)

### Want to change authentication?
→ `backend/middleware/auth.js` (JWT verification)
→ `backend/routes/auth.js` (login/register)
→ `frontend/src/context/AuthContext.js` (frontend auth state)

### Want to add a new distributed service?
→ `docker-compose.yml` (add new service)
→ Create service file in `backend/services/`

## 📚 Documentation Files

- **README.md**: Overview, quick start, architecture
- **SETUP.md**: Detailed setup instructions
- **FEATURES.md**: Feature documentation
- **DISTRIBUTED_CONCEPTS.md**: Distributed system concepts explained
- **CODING_STANDARDS.md**: Coding rules and best practices
- **PROJECT_STRUCTURE.md**: This file
- **ARCHITECTURE.md**: System architecture details

## 🎯 Key Principles

1. **Separation**: Backend and frontend are separate
2. **Services**: Business logic in `/services`
3. **Routes**: API endpoints in `/routes`
4. **Components**: UI components are reusable
5. **Context**: Global state in Context API
6. **Environment**: Configuration via .env files
7. **Docker**: All services run in containers

This structure makes it easy to:
- Find code you're looking for
- Add new features
- Understand how things work
- Maintain and debug
- Learn from the codebase


