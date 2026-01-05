#!/bin/bash
echo "=== Deploying Distributed File System on Azure VM ==="

# Clone or copy project (assuming it's already cloned)
# If not cloned, uncomment the next line:
# git clone https://github.com/yourusername/distributed-file-system.git
# cd distributed-file-system

# Clean any existing containers
echo "Cleaning up existing containers..."
docker-compose down -v 2>/dev/null || true
docker system prune -f

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
rm -rf node_modules package-lock.json
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
rm -rf node_modules package-lock.json
npm install

# Build frontend for production
echo "Building frontend for production..."
npm run build

# Go back to root directory
cd ..

# Start the distributed system
echo "Starting distributed system..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Check service status
echo "Service status:"
docker-compose ps

# Start backend application
echo "Starting backend application..."
cd backend
npm start &
BACKEND_PID=$!

# Start frontend application (serving built files)
echo "Starting frontend application..."
cd ../frontend
npx serve -s build -l 3000 &
FRONTEND_PID=$!

echo "=== Deployment Complete ==="
echo "Demo URL: http://$(curl -s ifconfig.me):3000"
echo "Backend API: http://$(curl -s ifconfig.me):5000"
echo ""
echo "To stop the demo:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo "docker-compose down"
echo ""
echo "Press Ctrl+C to exit this script (applications will continue running)"

# Keep script running to show logs
wait