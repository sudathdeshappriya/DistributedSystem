# Quick Start Guide

Get the system running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:
- ✅ Docker Desktop installed and running
- ✅ Node.js (v16+) installed
- ✅ npm installed

## Step-by-Step Setup

### Step 1: Start Docker Services (2 minutes)

Open a terminal in the project root and run:

```bash
docker-compose up -d
```

Wait 30-60 seconds for services to initialize. Verify they're running:

```bash
docker-compose ps
```

You should see:
- `etcd` - running
- `minio1` - running
- `minio2` - running
- `minio3` - running

### Step 2: Setup Backend (1 minute)

Open a new terminal:

```bash
cd backend
npm install
```

Create `.env` file:

**Windows (PowerShell):**
```powershell
@"
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
"@ | Out-File -FilePath .env -Encoding utf8
```

**Mac/Linux:**
```bash
cat > .env << EOF
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
EOF
```

Start the backend:

```bash
npm start
```

You should see:
```
✓ etcd connected (Raft consensus enabled)
✓ MinIO connected and bucket ready (3-node distributed mode)
✓ Server running on port 5000
```

### Step 3: Setup Frontend (1 minute)

Open another new terminal:

```bash
cd frontend
npm install
npm start
```

The React app will open automatically at http://localhost:3000

### Step 4: Login (30 seconds)

Use the default admin credentials:
- **Username**: `admin`
- **Password**: `admin123`

Or create a new account using the Register link.

## ✅ You're Ready!

You should now see:
- ✅ Dashboard with file management
- ✅ Upload/download functionality
- ✅ Notification system
- ✅ Modern, responsive UI

## 🔍 Verify Everything Works

### Test File Upload:
1. Click "Upload File"
2. Select any file
3. Click "Upload File" button
4. Watch the progress bar
5. See the file appear in the grid

### Test File Download:
1. Click the download button on any file card
2. File should download to your Downloads folder

### Test Notifications:
1. Upload or delete a file
2. See toast notification appear
3. Click bell icon in navbar to see all notifications

### Test High Availability:
1. Stop one MinIO node: `docker stop minio2`
2. Try to download a file - should still work!
3. Start it again: `docker start minio2`

## 🆘 Troubleshooting

### Docker services not starting?
```bash
# Check logs
docker-compose logs

# Restart everything
docker-compose down
docker-compose up -d
```

### Backend won't start?
- Check if port 5000 is already in use
- Verify .env file exists in backend folder
- Check Docker services are running: `docker-compose ps`

### Frontend won't start?
- Check if port 3000 is already in use
- Verify backend is running on port 5000
- Check browser console for errors

### Can't login?
- Use: username: `admin`, password: `admin123`
- Or register a new account
- Check backend logs for errors

## 📖 Next Steps

- Read `README.md` for full documentation
- Read `DISTRIBUTED_CONCEPTS.md` to understand the concepts
- Read `FEATURES.md` to see all features
- Explore the code to learn from it!

## 🎓 Learning Resources

All distributed system concepts are explained in code comments:
- High Availability → `backend/services/minioService.js`
- Consistency → `backend/services/etcdService.js`
- Reliability → `backend/routes/files.js`
- Concurrency → `backend/CONCURRENCY_NOTES.md`
- Scalability → `backend/server.js`

**Happy Learning! 🚀**


