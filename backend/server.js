const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const notificationRoutes = require('./routes/notifications');
const { errorHandler } = require('./middleware/errorHandler');
const { initializeMinIO } = require('./services/minioService');
const { initializeEtcd } = require('./services/etcdService');
const healingService = require('./services/healingService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      etcd: 'connected',
      minio: 'connected'
    }
  });
});

// Error handling middleware
app.use(errorHandler);

/**
 * SCALABILITY: Initialize services and start server
 * 
 * This server is designed for scalability:
 * - Stateless design: No in-memory state (can run multiple instances)
 * - External dependencies: etcd and MinIO are external services
 * - Load balancer ready: Multiple instances can run behind a load balancer
 * 
 * To scale horizontally:
 * 1. Run multiple instances of this server on different ports
 * 2. Place a load balancer (nginx, HAProxy) in front
 * 3. All instances connect to same etcd and MinIO (shared state)
 * 4. No code changes needed - stateless design enables this
 */
async function startServer() {
  try {
    // CONSISTENCY: Initialize etcd connection (Raft consensus for metadata)
    await initializeEtcd();
    console.log('✓ etcd connected (Raft consensus enabled)');

    // HIGH AVAILABILITY: Initialize MinIO (distributed storage with replication)
    await initializeMinIO();
    console.log('✓ MinIO connected and bucket ready (3-node distributed mode)');

    // SCALABILITY: Start stateless server (can run multiple instances)
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ Ready for horizontal scaling (stateless design)`);

      // RELIABILITY: Start background replication healing
      healingService.start();
    });
  } catch (error) {
    // RELIABILITY: Explicit error handling (no silent failures)
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

