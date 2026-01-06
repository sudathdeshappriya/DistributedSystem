const { getMinioClients, getMinioNodeConfigs, BUCKET_NAME } = require('./minioService');
const { listAllFiles } = require('./etcdService');

/**
 * BACKGROUND REPLICATION HEALING: Service for maintaining data consistency
 *
 * This service demonstrates RELIABILITY by automatically repairing missing file replicas.
 * It ensures that files uploaded during node outages eventually get replicated to all nodes,
 * maintaining the distributed system's fault tolerance and data durability.
 *
 * Key Features:
 * - Periodic scanning of all files
 * - Detection of missing replicas
 * - Automatic copying between nodes
 * - Non-blocking background operation
 */

class HealingService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.healingInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Start the background healing service
   */
  start() {
    if (this.isRunning) {
      console.log('Healing service already running');
      return;
    }

    console.log('Starting background replication healing service...');
    this.isRunning = true;

    // Run initial healing cycle
    this.runHealingCycle();

    // Schedule periodic healing
    this.intervalId = setInterval(() => {
      this.runHealingCycle();
    }, this.healingInterval);

    console.log(`Healing service started - will run every ${this.healingInterval / 1000 / 60} minutes`);
  }

  /**
   * Stop the background healing service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Healing service not running');
      return;
    }

    console.log('Stopping background replication healing service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run a complete healing cycle
   */
  async runHealingCycle() {
    try {
      console.log('Starting healing cycle...');

      // Get all files from etcd
      const allFiles = await listAllFiles();
      console.log(`Found ${allFiles.length} files to check`);

      let healedCount = 0;
      let errorCount = 0;

      // Check each file
      for (const file of allFiles) {
        try {
          const wasHealed = await this.healFileIfNeeded(file.id, file);
          if (wasHealed) {
            healedCount++;
          }
        } catch (error) {
          console.error(`Error healing file ${file.id}:`, error.message);
          errorCount++;
        }
      }

      console.log(`Healing cycle completed - healed ${healedCount} files, ${errorCount} errors`);

    } catch (error) {
      console.error('Error in healing cycle:', error);
    }
  }

  /**
   * Check if a file needs healing and heal it if necessary
   */
  async healFileIfNeeded(fileId, metadata) {
    const clients = getMinioClients();
    const nodes = getMinioNodeConfigs();
    const missingNodes = [];

    // Check which nodes are missing the file
    for (let i = 0; i < clients.length; i++) {
      try {
        await clients[i].statObject(BUCKET_NAME, metadata.objectName);
        // File exists on this node
      } catch (error) {
        if (error.code === 'NoSuchKey' || error.message.includes('not found')) {
          missingNodes.push(i); // Node index missing the file
        } else {
          // Node might be down, skip for now
          console.log(`Node ${nodes[i]?.endpoint}:${nodes[i]?.port} appears down, skipping healing to it`);
        }
      }
    }

    if (missingNodes.length === 0) {
      // File is fully replicated
      return false;
    }

    console.log(`File ${fileId} (${metadata.filename}) missing on ${missingNodes.length} nodes, healing...`);

    // Find a source node that has the file
    let sourceClient = null;
    for (let i = 0; i < clients.length; i++) {
      if (!missingNodes.includes(i)) {
        try {
          await clients[i].statObject(BUCKET_NAME, metadata.objectName);
          sourceClient = clients[i];
          break;
        } catch (error) {
          // This node doesn't have it either, continue
        }
      }
    }

    if (!sourceClient) {
      console.error(`No source node found for file ${fileId}`);
      return false;
    }

    // Heal missing nodes
    for (const nodeIndex of missingNodes) {
      try {
        await this.copyFileToNode(sourceClient, clients[nodeIndex], metadata.objectName, metadata.mimetype);
        console.log(`Healed file ${fileId} to node ${nodes[nodeIndex]?.endpoint}:${nodes[nodeIndex]?.port}`);
      } catch (error) {
        console.error(`Failed to heal file ${fileId} to node ${nodes[nodeIndex]?.endpoint}:${nodes[nodeIndex]?.port}:`, error.message);
      }
    }

    return true;
  }

  /**
   * Copy a file from source client to target client
   */
  async copyFileToNode(sourceClient, targetClient, objectName, contentType) {
    // Get stream from source
    const stream = await sourceClient.getObject(BUCKET_NAME, objectName);

    // Collect the stream data
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Put to target
    const metaData = {
      'Content-Type': contentType || 'application/octet-stream',
    };

    await targetClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, metaData);
  }
}

module.exports = new HealingService();