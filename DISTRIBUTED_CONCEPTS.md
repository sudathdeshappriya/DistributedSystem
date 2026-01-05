# Distributed System Concepts Demonstrated

This document explains how the system demonstrates key distributed system concepts.

## 1. High Availability

### Definition
High Availability ensures the system continues operating even when individual components fail. The system remains accessible and functional despite node failures.

### Implementation

#### MinIO Distributed Mode
- **3-node cluster**: Files are automatically replicated across 3 MinIO nodes
- **Automatic failover**: When downloading, the system tries each node in sequence
- **No single point of failure**: If one node fails, others continue serving requests

#### Code Location
- `backend/services/minioService.js` - `getFileStreamFromReplica()`
- Implements automatic failover by trying nodes 9001 → 9003 → 9005

#### How It Works
```javascript
// Try each MinIO node until one succeeds
for (let i = 0; i < clients.length; i++) {
  try {
    const stream = await clients[i].getObject(BUCKET_NAME, objectName);
    return { stream, nodeIndex: i, nodePort: ports[i] };
  } catch (error) {
    // Continue to next replica - automatic failover
    continue;
  }
}
```

#### Testing
1. Start all 3 MinIO nodes: `docker-compose up -d`
2. Upload a file
3. Stop one node: `docker stop minio2`
4. Download the file - should still work (served from minio1 or minio3)

## 2. Reliability

### Definition
Reliability ensures that failures are detected, reported, and handled gracefully. No silent failures occur.

### Implementation

#### Error Handling Strategy
- **Explicit error responses**: All errors return proper HTTP status codes
- **Error propagation**: Errors are caught and returned to clients
- **Operation status**: Clients receive confirmation of success/failure

#### Code Locations
- `backend/routes/files.js` - All endpoints have try-catch blocks
- `backend/middleware/errorHandler.js` - Centralized error handling
- `backend/services/minioService.js` - Error handling for storage operations

#### Key Features
1. **Delete Operations**: Returns which replicas succeeded/failed
   ```javascript
   res.json({ 
     message: 'File deleted successfully',
     deletedFromReplicas: successfulDeletes,
     totalReplicas: deleteResults.length
   });
   ```

2. **Download Operations**: Clear error messages if file not found
3. **Upload Operations**: Validation before storage

#### Testing
- Upload a file to a stopped node - should return error
- Delete a file - check which replicas succeeded
- Download non-existent file - returns 404

## 3. Consistency

### Definition
Consistency ensures all nodes see the same data at the same time. Strong consistency means all reads see the most recent write.

### Implementation

#### etcd with Raft Consensus
- **Raft Algorithm**: etcd uses Raft for distributed consensus
- **Strong Consistency**: All metadata operations are linearizable
- **Metadata First**: File metadata is written to etcd before/alongside storage

#### Code Location
- `backend/services/etcdService.js` - All metadata operations
- `backend/routes/files.js` - Upload flow ensures metadata consistency

#### How Raft Works
1. **Leader Election**: etcd elects a leader node
2. **Log Replication**: All writes go through the leader
3. **Majority Consensus**: Operations require majority approval
4. **Linearizability**: All reads return the most recent write

#### Consistency Guarantees
```javascript
// Upload flow ensures consistency:
// 1. Upload file to MinIO (replicated automatically)
// 2. Store metadata in etcd (Raft ensures consistency)
// 3. Both operations succeed or both fail (transactional guarantee)

await uploadFileFromBuffer(...);  // Storage operation
await storeFileMetadata(...);      // Metadata operation (Raft consensus)
```

#### Testing
1. Upload a file
2. Immediately list files - new file appears immediately
3. All API instances see the same file list (strong consistency)

## 4. Concurrency

### Definition
Concurrency handles multiple operations happening simultaneously without conflicts or data corruption.

### Implementation

#### Concurrent File Operations
- **Multiple uploads**: Different users can upload simultaneously
- **Multiple downloads**: Same file can be downloaded by multiple users
- **Metadata isolation**: Each file has unique ID (UUID) preventing conflicts

#### Code Features
1. **Unique Identifiers**: UUIDs prevent naming conflicts
   ```javascript
   const fileId = uuidv4();  // Unique ID prevents conflicts
   const objectName = `${req.user.id}/${fileId}${fileExtension}`;
   ```

2. **Stateless API**: Each request is independent
3. **No locking**: etcd handles concurrent writes via Raft
4. **Atomic Operations**: etcd operations are atomic

#### Concurrent Access Patterns
- **Read-Read**: Multiple users can download same file (safe)
- **Write-Write**: Different users uploading different files (isolated by user ID)
- **Read-Write**: User uploading while others download (MinIO handles this)

#### Testing
1. Open multiple browser tabs
2. Upload different files simultaneously
3. Download same file from multiple tabs
4. All operations should succeed without conflicts

## 5. Scalability

### Definition
Scalability is the ability to handle increased load by adding resources without redesigning the system.

### Implementation

#### Horizontal Scaling Support

##### API Layer (Stateless)
- **Stateless Design**: No server-side session storage
- **JWT Tokens**: Authentication state in tokens (client-side)
- **Load Balancer Ready**: Can add multiple API instances

##### Storage Layer (MinIO)
- **Add More Nodes**: MinIO distributed mode supports adding nodes
- **Automatic Replication**: New nodes automatically receive data
- **No Bottleneck**: Each node can serve requests independently

##### Metadata Layer (etcd)
- **Cluster Mode**: etcd supports multi-node clusters
- **Read Scaling**: Reads can be served by any etcd node
- **Write Scaling**: Writes go through leader (acceptable for metadata)

#### Scaling Architecture
```
Current:
[API Server] → [etcd (1 node)] → [MinIO (3 nodes)]

Scalable to:
[API Server 1]  ┐
[API Server 2]  ├→ [Load Balancer] → [etcd Cluster (3 nodes)] → [MinIO (N nodes)]
[API Server N]  ┘
```

#### Code Design for Scalability
1. **No Shared State**: API server is stateless
2. **Distributed Storage**: Files distributed across nodes
3. **Metadata Scaling**: etcd can be clustered
4. **Connection Pooling**: MinIO clients are created per operation

#### Adding More MinIO Nodes
1. Update `docker-compose.yml` to add more minio services
2. Update `getMinioClients()` to include new ports
3. System automatically distributes files to new nodes

#### Testing Scalability
1. Start multiple API instances on different ports
2. Use load balancer (nginx) to distribute requests
3. Upload/download from multiple API instances
4. All should work correctly (stateless design)

## Summary

| Concept | Implementation | Key Technology |
|---------|---------------|----------------|
| High Availability | Replica failover | MinIO distributed mode |
| Reliability | Error handling | Try-catch + HTTP status codes |
| Consistency | Raft consensus | etcd with Raft |
| Concurrency | UUID + stateless | UUID + stateless API |
| Scalability | Horizontal scaling | Stateless API + distributed storage |

## Demonstration Scripts

### Test High Availability
```bash
# 1. Upload file
curl -X POST http://localhost:5000/api/files/upload \
  -H "Authorization: Bearer TOKEN" -F "file=@test.txt"

# 2. Stop one MinIO node
docker stop minio2

# 3. Download file (should still work)
curl -X GET http://localhost:5000/api/files/download/FILE_ID \
  -H "Authorization: Bearer TOKEN" -o downloaded.txt
```

### Test Consistency
```bash
# 1. Upload file
curl -X POST ... -F "file=@test.txt"

# 2. Immediately list files (should see new file)
curl -X GET http://localhost:5000/api/files/list \
  -H "Authorization: Bearer TOKEN"
```

### Test Concurrency
```bash
# Run multiple uploads in parallel
for i in {1..5}; do
  curl -X POST ... -F "file=@test$i.txt" &
done
wait
```

### Test Reliability
```bash
# Try to download non-existent file
curl -X GET http://localhost:5000/api/files/download/invalid-id \
  -H "Authorization: Bearer TOKEN"
# Should return 404 with clear error message
```


