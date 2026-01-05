# Distributed File Storage System

A small-scale distributed upload-download system (similar to Google Drive but simplified) designed to demonstrate distributed systems concepts including high availability, reliability, consistency, scalability, and security.

## 🏗️ Architecture Overview

### Components

1. **Frontend**: React application with Tailwind CSS
   - Modern, responsive web interface
   - User authentication and file management
   - Real-time notifications

2. **Backend**: Node.js with Express
   - RESTful API
   - JWT-based authentication
   - Role-based authorization (admin/user)

3. **Distributed Services**:
   - **etcd**: Metadata storage with Raft consensus protocol
   - **MinIO**: Object storage with 3-node distributed setup
   - **Docker Compose**: Orchestration of all services

### System Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────────────────────────────────┐
│         Express API Server              │
│  (Authentication, Authorization, API)   │
└──┬────────────────────┬─────────────────┘
   │                    │
   │                    │
┌──▼─────┐         ┌────▼──────────┐
│  etcd  │         │    MinIO      │
│ (Raft) │         │  (3 nodes)    │
│        │         │  Replication  │
└────────┘         └───────────────┘
```

## ✨ Features

- **Distributed Architecture**: Services distributed across containers
- **High Availability**: MinIO 3-node setup with replication
- **Consistency**: etcd provides strong consistency via Raft consensus
- **Security**: JWT authentication, role-based access control, password hashing
- **Scalability**: Stateless API design, distributed storage
- **File Operations**: Upload, download, delete files
- **User Management**: Registration, login, admin/user roles

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Docker** and **Docker Compose**
- **Git**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Project 3"
```

### 2. Start Distributed Services

Start etcd and MinIO using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- **etcd** on port `2379`
- **MinIO nodes** on ports `9001`, `9003`, `9005` (API) and `9002`, `9004`, `9006` (Console)

Wait a few moments for all services to initialize.

**Note**: MinIO distributed mode requires all 3 nodes to be running. If you see errors about nodes not being ready, wait a bit longer and check logs:

```bash
docker-compose logs minio1
```

### 3. Configure Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

ETCD_HOST=localhost
ETCD_PORT=2379

MINIO_ENDPOINT=localhost
MINIO_PORT=9001
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=distributed-files

FRONTEND_URL=http://localhost:3000
```

### 4. Start Backend Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

The API server will start on `http://localhost:5000`

### 5. Configure and Start Frontend

Open a new terminal, navigate to the frontend directory:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (optional, defaults are set):

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Start the React development server:

```bash
npm start
```

The frontend will open at `http://localhost:3000`

### 6. Access the Application

1. Open your browser and navigate to `http://localhost:3000`
2. **Default Admin Credentials**:
   - Username: `admin`
   - Password: `admin123`
3. Register a new user or login with admin credentials
4. Start uploading and managing files!

## 📁 Project Structure

```
Project 3/
├── backend/
│   ├── config/
│   │   └── database.js          # In-memory user storage
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication middleware
│   │   └── errorHandler.js      # Error handling middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   └── files.js             # File operation routes
│   ├── services/
│   │   ├── etcdService.js       # etcd client service
│   │   └── minioService.js      # MinIO client service
│   ├── scripts/
│   │   └── initAdmin.js         # Admin password hash generator
│   ├── server.js                # Express server entry point
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.js    # File upload component
│   │   │   ├── FileList.js      # File list component
│   │   │   ├── Navbar.js        # Navigation bar
│   │   │   ├── NotificationPanel.js
│   │   │   └── PrivateRoute.js  # Protected route wrapper
│   │   ├── context/
│   │   │   ├── AuthContext.js   # Authentication context
│   │   │   └── NotificationContext.js
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   └── Dashboard.js
│   │   ├── services/
│   │   │   └── api.js           # Axios API client
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── docker-compose.yml           # Docker services configuration
├── .gitignore
└── README.md
```

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile (requires auth)
- `GET /api/auth/users` - Get all users (admin only)

### Files

- `POST /api/files/upload` - Upload file (requires auth)
- `GET /api/files/list` - List user's files (requires auth)
- `GET /api/files/download/:fileId` - Download file (requires auth)
- `GET /api/files/info/:fileId` - Get file info (requires auth)
- `DELETE /api/files/delete/:fileId` - Delete file (requires auth)

### Health Check

- `GET /api/health` - System health status

## 🔐 Authentication

The system uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🎯 Distributed Systems Concepts Demonstrated

This system clearly demonstrates five key distributed system concepts. See `DISTRIBUTED_CONCEPTS.md` for detailed explanations.

### 1. **High Availability** ✅
- MinIO runs in distributed mode with 3 nodes
- Replication ensures data redundancy
- **Automatic failover**: API redirects to available node if one fails
- System continues working even when individual nodes fail
- See code comments in `backend/services/minioService.js` - `getFileStreamFromReplica()`

### 2. **Consistency** ✅
- etcd uses Raft consensus algorithm for strong consistency
- All metadata operations are linearizable
- **Metadata-first approach**: Updates go through etcd (Raft) before storage
- Read-after-write consistency guaranteed
- See code comments in `backend/services/etcdService.js` - `storeFileMetadata()` and `getFileMetadata()`

### 3. **Reliability** ✅
- Distributed storage with replication
- **No silent failures**: Clients are notified when operations fail
- Explicit error responses with proper HTTP status codes
- Operation status reported to clients
- See code comments in `backend/routes/files.js` - delete endpoint returns replica status

### 4. **Concurrency** ✅
- Multiple users can upload/download simultaneously
- UUID-based file IDs prevent metadata conflicts
- User-specific paths isolate files (no cross-user conflicts)
- etcd handles concurrent writes via Raft consensus
- See `backend/CONCURRENCY_NOTES.md` for detailed explanation

### 5. **Scalability** ✅
- **Stateless API design**: Horizontal scaling ready
- No single bottleneck: Each component can scale independently
- System allows adding more storage nodes (just add to ports array)
- Load balancer ready (multiple API instances supported)
- See code comments in `backend/server.js` and `backend/services/minioService.js`

### 6. **Security**
- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (RBAC)
- File access control (users can only access their files, admins can access all)

## 🐳 Docker Services

### etcd
- **Image**: `quay.io/coreos/etcd:v3.5.9`
- **Ports**: `2379` (client), `2380` (peer)
- **Purpose**: Metadata storage with Raft consensus

### MinIO (3 nodes)
- **Image**: `minio/minio:latest`
- **Mode**: Distributed (3 nodes)
- **Ports**: 
  - Node 1: `9001` (API), `9002` (Console)
  - Node 2: `9003` (API), `9004` (Console)
  - Node 3: `9005` (API), `9006` (Console)
- **Credentials**: `minioadmin` / `minioadmin123`
- **Purpose**: Object storage with replication

### Access MinIO Console

You can access the MinIO console at:
- Node 1: http://localhost:9002
- Node 2: http://localhost:9004
- Node 3: http://localhost:9006

Login with: `minioadmin` / `minioadmin123`

## 🧪 Testing the System

### 1. Test High Availability

```bash
# Stop one MinIO node
docker stop minio2

# System should continue to work (files still accessible)
# Start it back
docker start minio2
```

### 2. Test Consistency

- Upload a file through the UI
- Check etcd for metadata: `docker exec -it etcd etcdctl get --prefix "files/"`
- Verify metadata is consistent

### 3. Test Security

- Try accessing another user's file (should fail)
- Test admin vs user permissions
- Verify JWT token validation

## 🛠️ Troubleshooting

### MinIO nodes not starting

If MinIO nodes show errors about not being able to connect:

1. Ensure all 3 nodes are running: `docker-compose ps`
2. Check logs: `docker-compose logs minio1`
3. Wait a few minutes for distributed mode initialization
4. If issues persist, try: `docker-compose down -v` then `docker-compose up -d`

### etcd connection errors

1. Check if etcd is running: `docker-compose ps etcd`
2. Test connection: `docker exec -it etcd etcdctl endpoint health`
3. Check logs: `docker-compose logs etcd`

### Backend connection issues

1. Verify `.env` file exists and has correct values
2. Check if services are running: `docker-compose ps`
3. Verify ports are not already in use
4. Check backend logs for specific error messages

### Frontend can't connect to backend

1. Verify backend is running on port 5000
2. Check `REACT_APP_API_URL` in frontend `.env`
3. Check CORS settings in backend
4. Verify browser console for errors

## 📝 Notes

- This is a **demonstration project** for educational purposes
- User data is stored in-memory (restarts clear user data, but files remain)
- For production use, replace in-memory storage with a proper database
- MinIO distributed mode requires all nodes to be running
- etcd data persists in Docker volumes

## 🎓 Learning Outcomes

This project demonstrates:

1. **Distributed System Design**: Separation of concerns (API, metadata, storage)
2. **Consensus Algorithms**: Raft protocol in etcd
3. **Distributed Storage**: MinIO distributed mode with replication
4. **API Design**: RESTful APIs, stateless design
5. **Security**: Authentication, authorization, data protection
6. **Containerization**: Docker Compose for service orchestration
7. **Frontend-Backend Integration**: Modern React frontend with REST API

## 📋 Coding Standards

This project follows clear coding standards:

- **Clean Folder Structure**: Organized by concern (routes, services, components)
- **Clear Comments**: Distributed system concepts explained in code comments
- **No Overengineering**: Simple, practical solutions
- **Beginner-Friendly**: Readable code with descriptive names
- **Environment Variables**: All configuration via .env files
- **Dockerized Services**: All services run in Docker containers

See `CODING_STANDARDS.md` for detailed guidelines and `PROJECT_STRUCTURE.md` for folder explanations.

## 📄 License

This project is created for educational purposes as part of a Distributed Systems and Cloud Computing course module.

## 👥 Contributors

Created as part of an undergraduate group project.

---

**Happy Coding! 🚀**

