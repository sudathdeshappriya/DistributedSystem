const { Etcd3 } = require('etcd3');

let etcdClient = null;

// Initialize etcd client
const initializeEtcd = async () => {
  // Connect to all etcd cluster nodes for high availability
  const hosts = [
    'http://localhost:2379',  // etcd1
    'http://localhost:2381',  // etcd2
    'http://localhost:2383'   // etcd3
  ];
  
  etcdClient = new Etcd3({
    hosts: hosts,
    auth: null // Add authentication if needed
  });

  // Test connection (try to get a non-existent key, which should not throw)
  try {
    await etcdClient.get('__health_check__').string();
  } catch (error) {
    // Key doesn't exist, which is fine - connection is working
    if (!error.message.includes('not found')) {
      throw error;
    }
  }
  
  return etcdClient;
};

// Get etcd client instance
const getEtcdClient = () => {
  if (!etcdClient) {
    throw new Error('etcd client not initialized. Call initializeEtcd() first.');
  }
  return etcdClient;
};

/**
 * CONSISTENCY: Store file metadata in etcd
 * 
 * This function demonstrates Strong Consistency via Raft consensus.
 * etcd uses the Raft algorithm to ensure all nodes agree on the same data.
 * 
 * Raft Consensus Process:
 * 1. Client sends write request to etcd leader
 * 2. Leader replicates to majority of nodes
 * 3. Once majority confirms, write is committed
 * 4. All subsequent reads see this write (linearizability)
 * 
 * Consistency Guarantees:
 * - Strong Consistency: All reads see the most recent write
 * - Linearizability: Operations appear to execute atomically
 * - Durability: Once committed, data persists across node failures
 * 
 * @param {string} fileId - Unique file identifier
 * @param {Object} metadata - File metadata object
 * @returns {Promise<Object>} - Stored metadata
 */
const storeFileMetadata = async (fileId, metadata) => {
  const client = getEtcdClient();
  const key = `files/${fileId}`;
  // CONSISTENCY: This write goes through Raft consensus
  // All etcd nodes will agree on this value before write completes
  await client.put(key).value(JSON.stringify(metadata));
  return metadata;
};

/**
 * CONSISTENCY: Get file metadata from etcd
 * 
 * This function demonstrates Strong Consistency - all reads see the most recent write.
 * etcd ensures linearizability: reads appear to execute atomically at some point
 * between their invocation and response.
 * 
 * Consistency Guarantees:
 * - Read-after-write consistency: Read immediately after write sees the write
 * - Monotonic reads: Successive reads never return older data
 * - All nodes return same value for same key (eventual + strong for single-node)
 * 
 * @param {string} fileId - Unique file identifier
 * @returns {Promise<Object|null>} - File metadata or null if not found
 */
const getFileMetadata = async (fileId) => {
  const client = getEtcdClient();
  const key = `files/${fileId}`;
  try {
    // CONSISTENCY: This read is linearizable - guaranteed to see latest committed write
    const value = await client.get(key).string();
    return value ? JSON.parse(value) : null;
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
};

// Delete file metadata from etcd
const deleteFileMetadata = async (fileId) => {
  const client = getEtcdClient();
  const key = `files/${fileId}`;
  await client.delete().key(key);
};

// List all files for a user
const listUserFiles = async (userId) => {
  const client = getEtcdClient();
  const prefix = 'files/';
  try {
    const allKVs = await client.getAll().prefix(prefix);
    
    const userFiles = [];
    // Handle both array and object responses from etcd3
    const kvArray = Array.isArray(allKVs) ? allKVs : Object.entries(allKVs).map(([key, value]) => ({ key, value }));
    
    for (const kv of kvArray) {
      try {
        const value = typeof kv.value === 'string' ? kv.value : (kv.value ? kv.value.toString() : kv[1]);
        const key = typeof kv.key === 'string' ? kv.key : kv[0];
        const metadata = JSON.parse(value);
        if (metadata.ownerId === userId) {
          userFiles.push({
            id: key.replace(prefix, ''),
            ...metadata
          });
        }
      } catch (error) {
        console.error(`Error parsing metadata for ${kv.key || kv[0]}:`, error);
      }
    }
    
    return userFiles;
  } catch (error) {
    console.error('Error listing user files:', error);
    return [];
  }
};

// Get all files (admin only)
const listAllFiles = async () => {
  const client = getEtcdClient();
  const prefix = 'files/';
  try {
    const allKVs = await client.getAll().prefix(prefix);
    
    const allFiles = [];
    // Handle both array and object responses from etcd3
    const kvArray = Array.isArray(allKVs) ? allKVs : Object.entries(allKVs).map(([key, value]) => ({ key, value }));
    
    for (const kv of kvArray) {
      try {
        const value = typeof kv.value === 'string' ? kv.value : (kv.value ? kv.value.toString() : kv[1]);
        const key = typeof kv.key === 'string' ? kv.key : kv[0];
        const metadata = JSON.parse(value);
        allFiles.push({
          id: key.replace(prefix, ''),
          ...metadata
        });
      } catch (error) {
        console.error(`Error parsing metadata for ${kv.key || kv[0]}:`, error);
      }
    }
    
    return allFiles;
  } catch (error) {
    console.error('Error listing all files:', error);
    return [];
  }
};

// Notification functions
// Store notification in etcd
const storeNotification = async (userId, notification) => {
  const client = getEtcdClient();
  const notificationId = notification.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const key = `notifications/${userId}/${notificationId}`;
  const notificationData = {
    id: notificationId,
    userId,
    type: notification.type,
    message: notification.message,
    fileId: notification.fileId || null,
    filename: notification.filename || null,
    read: false,
    createdAt: new Date().toISOString()
  };
  await client.put(key).value(JSON.stringify(notificationData));
  return notificationData;
};

// Get user notifications
const getUserNotifications = async (userId, unreadOnly = false) => {
  const client = getEtcdClient();
  const prefix = `notifications/${userId}/`;
  try {
    const allKVs = await client.getAll().prefix(prefix);
    
    const notifications = [];
    // Handle both array and object responses from etcd3
    const kvArray = Array.isArray(allKVs) ? allKVs : Object.entries(allKVs).map(([key, value]) => ({ key, value }));
    
    for (const kv of kvArray) {
      try {
        const value = typeof kv.value === 'string' ? kv.value : (kv.value ? kv.value.toString() : kv[1]);
        const notification = JSON.parse(value);
        if (!unreadOnly || !notification.read) {
          notifications.push(notification);
        }
      } catch (error) {
        console.error(`Error parsing notification for ${kv.key || kv[0]}:`, error);
      }
    }
    
    // Sort by creation date (newest first)
    return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

// Mark notification as read
const markNotificationAsRead = async (userId, notificationId) => {
  const client = getEtcdClient();
  const key = `notifications/${userId}/${notificationId}`;
  try {
    const value = await client.get(key).string();
    if (value) {
      const notification = JSON.parse(value);
      notification.read = true;
      notification.readAt = new Date().toISOString();
      await client.put(key).value(JSON.stringify(notification));
      return notification;
    }
    return null;
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
};

// Mark all notifications as read for a user
const markAllNotificationsAsRead = async (userId) => {
  const notifications = await getUserNotifications(userId, true);
  const results = [];
  for (const notification of notifications) {
    const updated = await markNotificationAsRead(userId, notification.id);
    if (updated) results.push(updated);
  }
  return results;
};

// Delete notification
const deleteNotification = async (userId, notificationId) => {
  const client = getEtcdClient();
  const key = `notifications/${userId}/${notificationId}`;
  await client.delete().key(key);
};

module.exports = {
  initializeEtcd,
  getEtcdClient,
  storeFileMetadata,
  getFileMetadata,
  deleteFileMetadata,
  listUserFiles,
  listAllFiles,
  storeNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
};

