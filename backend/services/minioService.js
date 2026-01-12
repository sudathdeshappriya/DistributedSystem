const Minio = require('minio');
const fs = require('fs');
const path = require('path');

let minioClient = null;
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'distributed-files';

const parseMinioNodes = () => {
  // Multi-VM support: MINIO_NODES is a comma-separated list of host:port
  // Example: MINIO_NODES=10.0.0.5:9000,10.0.0.6:9000,10.0.0.7:9000
  const raw = (process.env.MINIO_NODES || '').trim();
  if (raw) {
    return raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(entry => {
        const [host, portStr] = entry.split(':');
        const port = Number.parseInt(portStr, 10);
        if (!host || Number.isNaN(port)) {
          throw new Error(`Invalid MINIO_NODES entry: '${entry}'. Expected host:port`);
        }
        return { endpoint: host, port };
      });
  }

  // Local docker-compose defaults (single machine, multiple mapped ports)
  const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  return [
    { endpoint, port: 9001 },
    { endpoint, port: 9003 },
    { endpoint, port: 9005 }
  ];
};

// Initialize MinIO client with automatic failover
const initializeMinIO = async () => {
  const nodes = parseMinioNodes();
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  // Try connecting to each node until one succeeds (fault tolerance)
  let lastError = null;
  for (const node of nodes) {
    try {
      console.log(`Attempting to connect to MinIO at ${node.endpoint}:${node.port}...`);
      
      const testClient = new Minio.Client({
        endPoint: node.endpoint,
        port: node.port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey
      });

      // Test connection by checking bucket
      const bucketExists = await Promise.race([
        testClient.bucketExists(BUCKET_NAME),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000))
      ]);

      // Connection successful! Use this client
      minioClient = testClient;
      
      if (!bucketExists) {
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
        console.log(`Bucket '${BUCKET_NAME}' created successfully`);
      }
      
      console.log(`✓ Connected to MinIO at ${node.endpoint}:${node.port}`);
      return minioClient;
      
    } catch (error) {
      console.log(`Failed to connect to MinIO at ${node.endpoint}:${node.port}: ${error.message}`);
      lastError = error;
      // Continue to next node
    }
  }

  // All nodes failed
  throw new Error(`Failed to connect to any MinIO node. Last error: ${lastError?.message}`);
};

// Get MinIO client instance
const getMinioClient = () => {
  if (!minioClient) {
    throw new Error('MinIO client not initialized. Call initializeMinIO() first.');
  }
  return minioClient;
};

/**
 * HIGH AVAILABILITY: Upload file with automatic failover
 * 
 * This function demonstrates High Availability by implementing automatic failover.
 * If one MinIO node fails, the system automatically tries the next available node.
 * This ensures uploads continue working even when individual nodes fail.
 * 
 * Failover Strategy:
 * 1. Try primary connected node first (fastest path)
 * 2. If connection error, try all other nodes
 * 3. Return on first successful upload
 * 
 * @param {string} filePath - Local file path to upload
 * @param {string} objectName - Object name in MinIO
 * @param {string} contentType - MIME type
 * @returns {Promise} - Upload result
 */
const uploadFile = async (filePath, objectName, contentType) => {
  const metaData = {
    'Content-Type': contentType || 'application/octet-stream',
  };

  // HIGH AVAILABILITY: Try primary client first (fastest path)
  try {
    const client = getMinioClient();
    const result = await client.fPutObject(BUCKET_NAME, objectName, filePath, metaData);
    return result;
  } catch (primaryError) {
    // Check if it's a connection error that warrants failover
    if (!primaryError.message?.includes('EHOSTUNREACH') && 
        !primaryError.message?.includes('ECONNREFUSED') &&
        !primaryError.message?.includes('ETIMEDOUT')) {
      throw primaryError; // Not a connection error, propagate immediately
    }

    // HIGH AVAILABILITY: Primary node failed, try all other nodes
    const clients = getMinioClients();
    const nodes = getMinioNodeConfigs();
    let lastError = primaryError;

    for (let i = 0; i < clients.length; i++) {
      try {
        const result = await clients[i].fPutObject(BUCKET_NAME, objectName, filePath, metaData);
        console.log(`Upload succeeded via failover node: ${nodes[i]?.endpoint}:${nodes[i]?.port}`);
        return result;
      } catch (error) {
        lastError = error;
        continue; // Try next node
      }
    }

    // RELIABILITY: All nodes failed, throw explicit error
    throw new Error(`Upload failed on all MinIO nodes. Last error: ${lastError?.message}`);
  }
};

/**
 * HIGH AVAILABILITY: Upload file from buffer with automatic failover
 * 
 * This function demonstrates High Availability by implementing automatic failover.
 * If one MinIO node fails, the system automatically tries the next available node.
 * This ensures uploads continue working even when individual nodes fail.
 * 
 * Failover Strategy:
 * 1. Try primary connected node first (fastest path)
 * 2. If connection error, try all other nodes
 * 3. Return on first successful upload
 * 
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} objectName - Object name in MinIO
 * @param {string} contentType - MIME type
 * @returns {Promise}
 */
const uploadFileFromBuffer = async (buffer, objectName, contentType) => {
  const metaData = {
    'Content-Type': contentType || 'application/octet-stream',
  };

  // HIGH AVAILABILITY: Try primary client first (fastest path)
  try {
    const client = getMinioClient();
    await client.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);
    return;
  } catch (primaryError) {
    // Check if it's a connection error that warrants failover
    if (!primaryError.message?.includes('EHOSTUNREACH') && 
        !primaryError.message?.includes('ECONNREFUSED') &&
        !primaryError.message?.includes('ETIMEDOUT')) {
      throw primaryError; // Not a connection error, propagate immediately
    }

    // HIGH AVAILABILITY: Primary node failed, try all other nodes
    const clients = getMinioClients();
    const nodes = getMinioNodeConfigs();
    let lastError = primaryError;

    for (let i = 0; i < clients.length; i++) {
      try {
        await clients[i].putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);
        console.log(`Upload succeeded via failover node: ${nodes[i]?.endpoint}:${nodes[i]?.port}`);
        return;
      } catch (error) {
        lastError = error;
        continue; // Try next node
      }
    }

    // RELIABILITY: All nodes failed, throw explicit error
    throw new Error(`Upload failed on all MinIO nodes. Last error: ${lastError?.message}`);
  }
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
  const nodes = parseMinioNodes();
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin123';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  const clients = nodes.map(node => new Minio.Client({
    endPoint: node.endpoint,
    port: node.port,
    useSSL,
    accessKey,
    secretKey
  }));
  
  return clients;
};

const getMinioNodeConfigs = () => {
  return parseMinioNodes();
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
  const nodes = getMinioNodeConfigs();
  
  // HIGH AVAILABILITY: Try each replica node until one succeeds
  // This implements automatic failover - if one node is down, try the next
  let lastError = null;
  for (let i = 0; i < clients.length; i++) {
    try {
      const stream = await clients[i].getObject(BUCKET_NAME, objectName);
      // RELIABILITY: Return immediately on first success (no silent failures)
      // Include node info for monitoring/debugging
      return { stream, nodeIndex: i, nodePort: nodes[i]?.port, nodeEndpoint: nodes[i]?.endpoint };
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
  const nodes = getMinioNodeConfigs();
  const results = [];
  
  // RELIABILITY: Try to delete from all replicas and collect results
  // This ensures we attempt deletion on all nodes and report status
  for (let i = 0; i < clients.length; i++) {
    try {
      await clients[i].removeObject(BUCKET_NAME, objectName);
      results.push({ nodeIndex: i, nodeEndpoint: nodes[i]?.endpoint, nodePort: nodes[i]?.port, success: true });
    } catch (error) {
      // RELIABILITY: Record failure instead of throwing (partial success is better than total failure)
      // Client will be notified which replicas failed
      results.push({ 
        nodeIndex: i, 
        nodeEndpoint: nodes[i]?.endpoint,
        nodePort: nodes[i]?.port, 
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
/**
 * HIGH AVAILABILITY: Get storage locations with timeout protection
 * 
 * This function checks which MinIO nodes have the file.
 * Uses timeout protection to avoid hanging on unreachable nodes.
 */
const getStorageLocations = async (objectName) => {
  const clients = getMinioClients();
  const nodes = getMinioNodeConfigs();
  const locations = [];
  
  // SCALABILITY: Check all nodes to determine file distribution
  // This allows system to track which nodes have data (important for scaling)
  for (let i = 0; i < clients.length; i++) {
    try {
      // HIGH AVAILABILITY: Add timeout to prevent hanging on unreachable nodes
      const statCheck = clients[i].statObject(BUCKET_NAME, objectName);
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Node check timeout')), 3000)
      );
      
      await Promise.race([statCheck, timeout]);
      
      locations.push({
        nodeIndex: i,
        endpoint: nodes[i]?.endpoint,
        port: nodes[i]?.port
      });
    } catch (error) {
      // File doesn't exist on this node OR node is unreachable
      // HIGH AVAILABILITY: Continue checking other nodes
      continue;
    }
  }
  
  return locations;
};

module.exports = {
  initializeMinIO,
  getMinioClient,
  getMinioClients,
  getMinioNodeConfigs,
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

