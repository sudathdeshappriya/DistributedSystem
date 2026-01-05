# Setup Guide

## Initial Setup Steps

### 1. Generate Admin Password Hash (Optional)

If you need to regenerate the admin password hash, run:

```bash
cd backend
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(hash => console.log('Hash:', hash));"
```

Copy the generated hash to `backend/config/database.js` replacing the `ADMIN_PASSWORD_HASH` value.

**Note**: The default admin credentials are:
- Username: `admin`
- Password: `admin123`

The password hash is already set in the code, but you can regenerate it if needed.

### 2. Environment Variables

#### Backend (.env file)

Create `backend/.env`:

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

#### Frontend (.env file - Optional)

Create `frontend/.env` (optional, defaults are set):

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Starting Services

**Order of startup:**

1. Start Docker services first:
   ```bash
   docker-compose up -d
   ```

2. Wait for services to be ready (especially MinIO nodes):
   ```bash
   docker-compose ps
   ```

3. Start backend:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. Start frontend (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm start
   ```

## Verifying Setup

### Check etcd

```bash
docker exec -it etcd etcdctl endpoint health
```

### Check MinIO

Access MinIO console:
- http://localhost:9002 (Node 1)
- http://localhost:9004 (Node 2)
- http://localhost:9006 (Node 3)

Login: `minioadmin` / `minioadmin123`

### Check Backend API

```bash
curl http://localhost:5000/api/health
```

### Check Frontend

Open browser: http://localhost:3000

## Troubleshooting

### MinIO Distributed Mode Issues

MinIO distributed mode requires all 3 nodes to start simultaneously. If you encounter errors:

1. Stop all services:
   ```bash
   docker-compose down
   ```

2. Remove volumes (WARNING: This deletes all data):
   ```bash
   docker-compose down -v
   ```

3. Start again:
   ```bash
   docker-compose up -d
   ```

4. Check logs:
   ```bash
   docker-compose logs -f minio1
   ```

### Port Conflicts

If ports are already in use, modify `docker-compose.yml` to use different ports, or stop the conflicting services.

### Admin Login Issues

If admin login doesn't work:

1. Verify the password hash in `backend/config/database.js`
2. Generate a new hash (see step 1 above)
3. Restart the backend server


