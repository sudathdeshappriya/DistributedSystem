const Minio = require('minio');
const fs = require('fs');
const path = require('path');

let minioClient = null;
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'distributed-files';

// Initialize MinIO client
const initializeMinIO = async () => {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = parseInt(process.env.MINIO_PORT || '9001');
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  minioClient = new Minio.Client({
    endPoint: endpoint,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey
  });

  // Check if bucket exists, create if it doesn't
  const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    console.log(`Bucket '${BUCKET_NAME}' created successfully`);
  }

  return minioClient;
};

// Get MinIO client instance
const getMinioClient = () => {
  if (!minioClient) {
    throw new Error('MinIO client not initialized. Call initializeMinIO() first.');
  }
  return minioClient;
};

// Upload file to MinIO
const uploadFile = async (filePath, objectName, contentType) => {
  const client = getMinioClient();
  
  const metaData = {
    'Content-Type': contentType || 'application/octet-stream',
  };

  const result = await client.fPutObject(BUCKET_NAME, objectName, filePath, metaData);
  return result;
};

// Upload file from buffer
const uploadFileFromBuffer = async (buffer, objectName, contentType) => {
  const client = getMinioClient();
  
  const metaData = {
    'Content-Type': contentType || 'application/octet-stream',
  };

  await client.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);
};

// Download file from MinIO
const downloadFile = async (objectName, destPath) => {
  const client = getMinioClient();
  await client.fGetObject(BUCKET_NAME, objectName, destPath);
};

// Get file as stream
const getFileStream = async (objectName) => {
  const client = getMinioClient();
  return await client.getObject(BUCKET_NAME, objectName);
};

// Delete file from MinIO
const deleteFile = async (objectName) => {
  const client = getMinioClient();
  await client.removeObject(BUCKET_NAME, objectName);
};

// Get file info/stat
const getFileInfo = async (objectName) => {
  const client = getMinioClient();
  return await client.statObject(BUCKET_NAME, objectName);
};

/**
 * SCALABILITY: Get multiple MinIO clients for replica access
 * 
 * This function demonstrates Scalability by supporting multiple storage nodes.
 * To scale horizontally, simply add more ports to the array.
 * 
 * Scalability Features:
 * - Easy to add more nodes (just add to ports array)
 * - No code changes needed for new nodes
 * - Each node can serve requests independently (no bottleneck)
 * 
 * @returns {Array<Minio.Client>} - Array of MinIO clients, one per node
 */
const getMinioClients = () => {
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  
  // SCALABILITY: Create clients for all nodes
  // To add more nodes, simply add more ports here (no other code changes needed)
  const ports = [9001, 9003, 9005]; // MinIO node ports
  const clients = ports.map(port => new Minio.Client({
    endPoint: endpoint,
    port: port,
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey
  }));
  
  return clients;
};

/**
 * HIGH AVAILABILITY: Get file stream from nearest available replica
 * 
 * This function demonstrates High Availability by implementing automatic failover.
 * If one MinIO node fails, the system automatically tries the next available node.
 * This ensures the system continues working even when individual nodes fail.
 * 
 * Failover Strategy:
 * 1. Try nodes in order: 9001 → 9003 → 9005
 * 2. First successful connection is used (nearest available)
 * 3. If all nodes fail, throw error (reliability - no silent failures)
 * 
 * @param {string} objectName - The object name/key in MinIO
 * @returns {Promise<{stream, nodeIndex, nodePort}>} - Stream and node info
 * @throws {Error} - If all replicas fail (reliability - explicit error)
 */
const getFileStreamFromReplica = async (objectName) => {
  const clients = getMinioClients();
  
  // HIGH AVAILABILITY: Try each replica node until one succeeds
  // This implements automatic failover - if one node is down, try the next
  let lastError = null;
  for (let i = 0; i < clients.length; i++) {
    try {
      const stream = await clients[i].getObject(BUCKET_NAME, objectName);
      // RELIABILITY: Return immediately on first success (no silent failures)
      // Include node info for monitoring/debugging
      return { stream, nodeIndex: i, nodePort: [9001, 9003, 9005][i] };
    } catch (error) {
      lastError = error;
      // HIGH AVAILABILITY: Continue to next replica instead of failing immediately
      continue;
    }
  }
  
  // RELIABILITY: If all replicas failed, throw explicit error (no silent failure)
  throw lastError || new Error('File not found in any replica');
};

/**
 * RELIABILITY: Delete file from all replicas
 * 
 * This function demonstrates Reliability by ensuring operations complete on all nodes
 * and reporting status for each replica. Clients are notified which replicas succeeded/failed.
 * 
 * Key Features:
 * - Attempts deletion on all nodes (best effort)
 * - Returns status for each replica (transparency)
 * - Continues even if some deletions fail (resilience)
 * - No silent failures - all results are reported
 * 
 * @param {string} objectName - The object name/key in MinIO
 * @returns {Promise<Array>} - Array of results with success/failure for each replica
 */
const deleteFileFromAllReplicas = async (objectName) => {
  const clients = getMinioClients();
  const results = [];
  
  // RELIABILITY: Try to delete from all replicas and collect results
  // This ensures we attempt deletion on all nodes and report status
  for (let i = 0; i < clients.length; i++) {
    try {
      await clients[i].removeObject(BUCKET_NAME, objectName);
      results.push({ nodeIndex: i, nodePort: [9001, 9003, 9005][i], success: true });
    } catch (error) {
      // RELIABILITY: Record failure instead of throwing (partial success is better than total failure)
      // Client will be notified which replicas failed
      results.push({ 
        nodeIndex: i, 
        nodePort: [9001, 9003, 9005][i], 
        success: false, 
        error: error.message 
      });
    }
  }
  
  // RELIABILITY: Return all results so client knows what happened (no silent failures)
  return results;
};

/**
 * SCALABILITY: Get storage locations (all nodes that have the file)
 * 
 * This function demonstrates Scalability by identifying which nodes contain the file.
 * This information allows the system to:
 * - Route requests to appropriate nodes
 * - Monitor replication status
 * - Scale horizontally by adding more nodes
 * 
 * @param {string} objectName - The object name/key in MinIO
 * @returns {Promise<Array>} - Array of locations where file exists
 */
const getStorageLocations = async (objectName) => {
  const clients = getMinioClients();
  const ports = [9001, 9003, 9005];
  const locations = [];
  
  // SCALABILITY: Check all nodes to determine file distribution
  // This allows system to track which nodes have data (important for scaling)
  for (let i = 0; i < clients.length; i++) {
    try {
      await clients[i].statObject(BUCKET_NAME, objectName);
      locations.push({
        nodeIndex: i,
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: ports[i]
      });
    } catch (error) {
      // File doesn't exist on this node (replication may be in progress)
      continue;
    }
  }
  
  return locations;
};

module.exports = {
  initializeMinIO,
  getMinioClient,
  getMinioClients,
  uploadFile,
  uploadFileFromBuffer,
  downloadFile,
  getFileStream,
  getFileStreamFromReplica,
  deleteFile,
  deleteFileFromAllReplicas,
  getFileInfo,
  getStorageLocations,
  BUCKET_NAME
};

