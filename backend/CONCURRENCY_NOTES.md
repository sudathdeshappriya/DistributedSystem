# Concurrency Handling

## How the System Handles Concurrent Operations

### 1. Concurrent File Uploads

**Scenario**: Multiple users upload files simultaneously

**Handling**:
- **UUID-based file IDs**: Each file gets a unique UUID, preventing naming conflicts
- **User-specific paths**: Files stored as `userId/fileId.ext` - isolates users
- **Atomic etcd writes**: Raft consensus ensures metadata writes are atomic
- **MinIO handles concurrent writes**: MinIO's distributed mode handles concurrent uploads

**Code**:
```javascript
const fileId = uuidv4(); // Unique ID prevents collisions
const objectName = `${req.user.id}/${fileId}${fileExtension}`; // User isolation
```

### 2. Concurrent File Downloads

**Scenario**: Multiple users download the same file simultaneously

**Handling**:
- **No locking needed**: Reads don't conflict
- **Stream-based**: Each download gets its own stream
- **MinIO handles concurrent reads**: Storage layer supports parallel reads
- **Replica selection**: Different requests may use different replicas

**Code**:
```javascript
// Multiple streams can be created for same file - no conflicts
const stream = await getFileStreamFromReplica(objectName);
stream.pipe(res); // Each request gets its own stream
```

### 3. Concurrent Metadata Reads/Writes

**Scenario**: Multiple API instances reading/writing metadata simultaneously

**Handling**:
- **Raft consensus**: etcd ensures all writes are ordered and consistent
- **Linearizability**: Reads see writes in order
- **Atomic operations**: Each etcd operation is atomic

**Code**:
```javascript
// Raft ensures concurrent writes are ordered
await storeFileMetadata(fileId, metadata);
// All subsequent reads see this write (strong consistency)
```

### 4. Concurrent File Deletes

**Scenario**: User tries to delete while others are downloading

**Handling**:
- **Delete from all replicas**: Attempts deletion on all nodes
- **Download continues**: If download already started, it may complete
- **Metadata cleanup**: Metadata deleted after storage deletion
- **No locks**: Best-effort deletion (storage handles this)

### 5. Race Conditions Prevented

**Prevention Mechanisms**:
1. **UUID uniqueness**: Probability of collision is negligible
2. **User isolation**: User-specific paths prevent cross-user conflicts
3. **Raft ordering**: etcd orders all writes (no race conditions in metadata)
4. **Stateless API**: No shared state between requests

### 6. Example Concurrent Operations

```javascript
// User A uploads file1.txt at time T1
// User B uploads file2.txt at time T1 (simultaneously)
// Result: Both succeed, no conflicts (different UUIDs)

// User A uploads file.txt
// User B downloads file.txt simultaneously
// Result: Download works (MinIO handles concurrent read/write)

// User A deletes file.txt
// User B tries to download file.txt at same time
// Result: 
// - If download started first: may succeed
// - If delete started first: download fails with 404
```

### 7. No Locking Needed

The system avoids locks by:
- Using UUIDs (unique identifiers)
- User-specific paths (isolation)
- Immutable file IDs (no updates, only create/delete)
- Read operations don't need locks
- etcd handles write ordering via Raft

This makes the system highly concurrent and performant.


