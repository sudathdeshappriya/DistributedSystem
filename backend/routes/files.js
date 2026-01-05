const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { 
  uploadFileFromBuffer, 
  getFileStream,
  getFileStreamFromReplica,
  deleteFileFromAllReplicas,
  getStorageLocations
} = require('../services/minioService');
const {
  storeFileMetadata,
  getFileMetadata,
  deleteFileMetadata,
  listUserFiles,
  listAllFiles,
  storeNotification
} = require('../services/etcdService');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types for demo
    cb(null, true);
  }
});

/**
 * CONCURRENCY & CONSISTENCY: Upload file endpoint
 * 
 * This endpoint demonstrates:
 * 1. CONCURRENCY: UUID prevents naming conflicts when multiple users upload simultaneously
 * 2. CONSISTENCY: Metadata stored in etcd ensures consistent view across all clients
 * 3. HIGH AVAILABILITY: File replicated across MinIO nodes automatically
 * 4. RELIABILITY: Errors are caught and returned to client (no silent failures)
 * 
 * Concurrency Handling:
 * - UUID fileId ensures unique identifiers (no collisions)
 * - User-specific object names: userId/fileId (isolates user files)
 * - etcd handles concurrent writes via Raft consensus
 * 
 * Consistency Flow:
 * 1. Upload to MinIO (replicated automatically)
 * 2. Store metadata in etcd (Raft ensures consistency)
 * 3. All subsequent reads see this file immediately
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // CONCURRENCY: UUID ensures unique file IDs even with simultaneous uploads
    // Prevents naming conflicts when multiple users upload at the same time
    const fileId = uuidv4();
    const fileExtension = path.extname(req.file.originalname);
    // CONCURRENCY: User-specific path isolates files (userId/fileId prevents conflicts)
    const objectName = `${req.user.id}/${fileId}${fileExtension}`;

    // HIGH AVAILABILITY: Upload to MinIO (automatically replicated across all nodes)
    await uploadFileFromBuffer(
      req.file.buffer,
      objectName,
      req.file.mimetype
    );

    // SCALABILITY: Get storage locations to track which nodes have the file
    const storageLocations = await getStorageLocations(objectName);

    // CONSISTENCY: Store metadata in etcd (Raft consensus ensures all nodes agree)
    // This metadata write goes through Raft - all etcd nodes will have consistent view
    const metadata = {
      fileId,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      objectName,
      ownerId: req.user.id,
      ownerUsername: req.user.username,
      version: 1, // Initial version
      permissions: {
        owner: req.user.id,
        read: [req.user.id], // Owner can read
        write: [req.user.id], // Owner can write
        delete: [req.user.id] // Owner can delete
      },
      storageLocations: storageLocations.map(loc => ({
        endpoint: loc.endpoint,
        port: loc.port,
        nodeIndex: loc.nodeIndex
      })),
      uploadedAt: new Date().toISOString()
    };

    // CONSISTENCY: This write is linearizable - all subsequent reads will see it
    await storeFileMetadata(fileId, metadata);

    // Create notification for file upload
    await storeNotification(req.user.id, {
      type: 'upload',
      message: `File "${req.file.originalname}" uploaded successfully`,
      fileId: fileId,
      filename: req.file.originalname
    });

    // RELIABILITY: Return success response with file details
    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        filename: metadata.filename,
        size: metadata.size,
        mimetype: metadata.mimetype,
        version: metadata.version,
        storageLocations: metadata.storageLocations,
        uploadedAt: metadata.uploadedAt
      }
    });
  } catch (error) {
    // RELIABILITY: Catch errors and return to client (no silent failures)
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// List user's files
router.get('/list', authenticate, async (req, res) => {
  try {
    let files;
    if (req.user.role === 'admin') {
      files = await listAllFiles();
    } else {
      files = await listUserFiles(req.user.id);
    }

    // Format files for response
    const formattedFiles = files.map(file => ({
      id: file.id,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: file.uploadedAt,
      ownerUsername: file.ownerUsername,
      ...(req.user.role === 'admin' && { ownerId: file.ownerId })
    }));

    res.json({ files: formattedFiles });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * HIGH AVAILABILITY & CONSISTENCY: Download file endpoint
 * 
 * This endpoint demonstrates:
 * 1. HIGH AVAILABILITY: Automatic failover to available replicas
 * 2. CONSISTENCY: Reads metadata from etcd (strong consistency via Raft)
 * 3. CONCURRENCY: Multiple users can download same file simultaneously
 * 4. RELIABILITY: Clear error messages when file not found
 * 
 * High Availability Flow:
 * 1. Read metadata from etcd (consistency)
 * 2. Try download from node 9001, if fails try 9003, if fails try 9005
 * 3. First successful node serves the file (automatic failover)
 * 
 * Concurrency:
 * - Multiple simultaneous downloads supported (MinIO handles this)
 * - No locking needed - reads are safe to parallelize
 */
router.get('/download/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;

    // CONSISTENCY: Get metadata from etcd (Raft ensures consistent view)
    // All API instances will see the same metadata
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      // RELIABILITY: Clear error message when file not found
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions - only authenticated users can download (owner or admin)
    const hasReadPermission = req.user.role === 'admin' || 
                              metadata.ownerId === req.user.id ||
                              (metadata.permissions && metadata.permissions.read && 
                               metadata.permissions.read.includes(req.user.id));
    
    if (!hasReadPermission) {
      // RELIABILITY: Clear error message for permission denial
      return res.status(403).json({ error: 'Access denied. You do not have permission to download this file.' });
    }

    // HIGH AVAILABILITY: Get file stream from nearest available replica
    // If one node fails, automatically tries next node (automatic failover)
    const { stream, nodeIndex, nodePort } = await getFileStreamFromReplica(metadata.objectName);

    // Set response headers
    res.setHeader('Content-Type', metadata.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.filename}"`);
    res.setHeader('Content-Length', metadata.size);
    // HIGH AVAILABILITY: Include which node served the file (for monitoring)
    res.setHeader('X-Served-From-Node', nodePort.toString());

    // Create notification for file download (async, don't wait)
    storeNotification(req.user.id, {
      type: 'download',
      message: `File "${metadata.filename}" downloaded successfully`,
      fileId: fileId,
      filename: metadata.filename
    }).catch(err => console.error('Failed to create download notification:', err));

    // CONCURRENCY: Stream allows multiple simultaneous downloads
    // Pipe stream to response
    stream.pipe(res);
  } catch (error) {
    // RELIABILITY: Catch and return explicit errors (no silent failures)
    console.error('Download error:', error);
    if (error.code === 'NoSuchKey' || error.message.includes('not found')) {
      return res.status(404).json({ error: 'File not found in storage' });
    }
    res.status(500).json({ error: 'File download failed' });
  }
});

// Get file info
router.get('/info/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get metadata from etcd
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions
    if (req.user.role !== 'admin' && metadata.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      file: {
        id: metadata.fileId,
        filename: metadata.filename,
        size: metadata.size,
        mimetype: metadata.mimetype,
        uploadedAt: metadata.uploadedAt,
        ownerUsername: metadata.ownerUsername,
        ...(req.user.role === 'admin' && { ownerId: metadata.ownerId })
      }
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

/**
 * RELIABILITY & HIGH AVAILABILITY: Delete file endpoint
 * 
 * This endpoint demonstrates:
 * 1. RELIABILITY: Deletes from all replicas and reports status (no silent failures)
 * 2. HIGH AVAILABILITY: Attempts deletion on all nodes even if some fail
 * 3. CONSISTENCY: Metadata deleted after storage deletion (cleanup)
 * 
 * Reliability Features:
 * - Attempts deletion on all replicas (best effort)
 * - Returns status for each replica (transparency)
 * - Client knows which replicas succeeded/failed (no silent failures)
 * - Metadata cleanup even if storage deletion partially fails
 */
router.delete('/delete/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;

    // CONSISTENCY: Get metadata from etcd first (consistent view)
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      // RELIABILITY: Clear error when file not found
      return res.status(404).json({ error: 'File not found' });
    }

    // Check permissions - only file owner or admin can delete
    const hasDeletePermission = req.user.role === 'admin' || 
                                metadata.ownerId === req.user.id ||
                                (metadata.permissions && metadata.permissions.delete && 
                                 metadata.permissions.delete.includes(req.user.id));
    
    if (!hasDeletePermission) {
      // RELIABILITY: Clear error message for permission denial
      return res.status(403).json({ error: 'Access denied. Only file owner or admin can delete files.' });
    }

    // RELIABILITY & HIGH AVAILABILITY: Delete from all MinIO replicas
    // Returns status for each replica - client knows what happened
    const deleteResults = await deleteFileFromAllReplicas(metadata.objectName);
    const successfulDeletes = deleteResults.filter(r => r.success).length;

    // CONSISTENCY: Delete metadata from etcd (ensures consistent view)
    // Even if some storage deletions failed, metadata is cleaned up
    await deleteFileMetadata(fileId);

    // Create notification for file deletion
    await storeNotification(req.user.id, {
      type: 'delete',
      message: `File "${metadata.filename}" deleted successfully`,
      fileId: fileId,
      filename: metadata.filename
    });

    // RELIABILITY: Return detailed status (transparency - client knows what happened)
    res.json({ 
      message: 'File deleted successfully',
      deletedFromReplicas: successfulDeletes,
      totalReplicas: deleteResults.length
    });
  } catch (error) {
    // RELIABILITY: Error handling - try to clean up metadata even on error
    console.error('Delete error:', error);
    // Even if deletion from storage fails, try to delete metadata
    try {
      await deleteFileMetadata(req.params.fileId);
    } catch (metaError) {
      console.error('Failed to delete metadata:', metaError);
    }
    // RELIABILITY: Return explicit error (no silent failures)
    res.status(500).json({ error: 'File deletion failed' });
  }
});

module.exports = router;

