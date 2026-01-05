# System Architecture

## Overview

This distributed file storage system demonstrates core distributed systems concepts through a practical implementation. The system is designed with clear separation of concerns and utilizes industry-standard technologies.

## Architecture Diagram

```
                    ┌──────────────┐
                    │   Browser    │
                    │  (React App) │
                    └──────┬───────┘
                           │
                    HTTP/REST API
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼─────┐    ┌──────▼──────┐    ┌────▼─────┐
    │  Express │    │     JWT     │    │   CORS   │
    │   API    │    │     Auth    │    │          │
    └────┬─────┘    └─────────────┘    └──────────┘
         │
         │ Business Logic
         │
    ┌────┴─────────────────────────┐
    │                              │
┌───▼────────┐              ┌──────▼──────┐
│   etcd     │              │    MinIO    │
│  (Raft)    │              │ (3 nodes)   │
│            │              │             │
│ Metadata   │              │ Object      │
│ Storage    │              │ Storage     │
│            │              │             │
│ - File info│              │ - File data │
│ - User IDs │              │ - Blobs     │
│ - Timestamps│             │ - Replicated│
└────────────┘              └─────────────┘
```

## Component Details

### 1. Frontend (React + Tailwind CSS)

**Technology Stack:**
- React 18
- React Router v6
- Tailwind CSS 3
- Axios for API calls
- React Icons

**Components:**
- **Authentication**: Login and Registration pages
- **Dashboard**: Main file management interface
- **File Operations**: Upload, download, delete
- **Notifications**: Real-time feedback system

**Key Features:**
- Responsive design
- Client-side routing
- Context API for state management
- Protected routes

### 2. Backend API (Node.js + Express)

**Technology Stack:**
- Node.js
- Express.js
- JWT for authentication
- bcryptjs for password hashing
- Multer for file uploads

**Architecture:**
- RESTful API design
- Stateless server (scalable)
- Middleware-based authentication
- Role-based authorization

**API Endpoints:**
```
POST   /api/auth/register      - User registration
POST   /api/auth/login         - User login
GET    /api/auth/me            - Get current user
GET    /api/auth/users         - List all users (admin)

POST   /api/files/upload       - Upload file
GET    /api/files/list         - List files
GET    /api/files/download/:id - Download file
GET    /api/files/info/:id     - Get file info
DELETE /api/files/delete/:id   - Delete file

GET    /api/health             - Health check
```

### 3. etcd (Metadata Storage)

**Purpose:**
- Store file metadata (filename, size, owner, timestamps)
- User-to-file mappings
- Ensure strong consistency

**Technology:**
- etcd v3.5.9
- Raft consensus algorithm
- Single node (can be expanded to cluster)

**Data Model:**
```
Key: files/<fileId>
Value: {
  fileId: string,
  filename: string,
  size: number,
  mimetype: string,
  objectName: string,
  ownerId: string,
  ownerUsername: string,
  uploadedAt: ISO timestamp
}
```

**Consistency:**
- Strong consistency via Raft
- All reads and writes are consistent
- Linearizable operations

### 4. MinIO (Object Storage)

**Purpose:**
- Store actual file data
- Distributed storage with replication
- High availability

**Configuration:**
- 3-node distributed setup
- Automatic replication between nodes
- Erasure coding for fault tolerance

**Storage Model:**
```
Bucket: distributed-files
Object Key: <userId>/<fileId><extension>
```

**High Availability:**
- Files replicated across 3 nodes
- Survives single node failure
- Automatic failover

## Data Flow

### File Upload Flow

```
1. User selects file → Frontend
2. Frontend sends file to API → POST /api/files/upload
3. API validates JWT token → Auth Middleware
4. API stores file in MinIO → MinIO Service
5. API stores metadata in etcd → etcd Service
6. API returns success → Frontend
7. Frontend updates UI → Dashboard
```

### File Download Flow

```
1. User clicks download → Frontend
2. Frontend requests file → GET /api/files/download/:id
3. API validates JWT and permissions → Auth Middleware
4. API retrieves metadata from etcd → etcd Service
5. API retrieves file from MinIO → MinIO Service
6. API streams file to client → Response
7. Frontend triggers browser download
```

### File List Flow

```
1. User opens dashboard → Frontend
2. Frontend requests file list → GET /api/files/list
3. API validates JWT → Auth Middleware
4. API queries etcd for user's files → etcd Service
5. API filters by userId (or returns all for admin)
6. API returns file list → Frontend
7. Frontend displays files in table
```

## Distributed Systems Concepts

### 1. High Availability

**Implementation:**
- MinIO distributed mode with 3 nodes
- Replication ensures data redundancy
- If one node fails, system continues operating

**Demonstration:**
```bash
# Stop one MinIO node
docker stop minio2

# System continues to work
# Files still accessible from other nodes
```

### 2. Consistency

**Implementation:**
- etcd provides strong consistency via Raft
- All metadata operations are linearizable
- Read-after-write consistency guaranteed

**Demonstration:**
- Upload a file
- Immediately list files → file appears
- All nodes see the same state

### 3. Reliability

**Implementation:**
- Data replication (MinIO)
- Health checks (Docker)
- Error handling at all layers
- Transactional metadata operations

### 4. Scalability

**Implementation:**
- Stateless API design
- Horizontal scaling ready
- Distributed storage
- Load balancing compatible

**Scaling Options:**
- Add more API server instances
- Expand etcd cluster
- Add more MinIO nodes

### 5. Security

**Implementation:**
- JWT-based authentication
- Password hashing (bcrypt)
- Role-based access control
- File-level permissions
- HTTPS ready (configure MINIO_USE_SSL=true)

## Deployment Architecture

### Docker Compose Setup

```
Services:
├── etcd (single node)
│   └── Ports: 2379, 2380
│
└── MinIO Cluster (3 nodes)
    ├── minio1 → Ports: 9001, 9002
    ├── minio2 → Ports: 9003, 9004
    └── minio3 → Ports: 9005, 9006
```

### Network Architecture

- All services on `distributed-storage-network`
- Internal Docker networking
- External ports exposed for API access

## Performance Considerations

1. **File Upload:**
   - Uses memory storage (Multer)
   - Streams to MinIO
   - 100MB file size limit

2. **File Download:**
   - Streams from MinIO
   - No intermediate storage
   - Efficient for large files

3. **Metadata Queries:**
   - Fast key-value lookups (etcd)
   - Prefix-based filtering
   - Efficient for listing

## Limitations & Future Improvements

### Current Limitations

1. In-memory user storage (lost on restart)
2. Single etcd node (not clustered)
3. No caching layer
4. No CDN integration
5. Basic error handling

### Future Improvements

1. Replace in-memory DB with PostgreSQL/MongoDB
2. Add etcd cluster (3+ nodes)
3. Implement Redis caching
4. Add CDN for file delivery
5. Implement file versioning
6. Add search functionality
7. Implement file sharing between users
8. Add file preview capabilities
9. Implement rate limiting
10. Add comprehensive logging and monitoring

## Testing Strategy

### Manual Testing

1. **High Availability:**
   - Stop one MinIO node
   - Verify files still accessible

2. **Consistency:**
   - Upload file
   - Verify immediate visibility
   - Check all nodes have data

3. **Security:**
   - Test unauthorized access
   - Verify role-based permissions
   - Test JWT expiration

4. **Performance:**
   - Upload large files
   - Download multiple files
   - Stress test API

## Monitoring & Observability

### Health Checks

- `/api/health` endpoint
- Docker health checks
- Service status monitoring

### Logging

- Console logging in backend
- Error tracking
- Request logging (can be added)

---

**Note**: This architecture is designed for educational purposes to demonstrate distributed systems concepts. For production use, additional considerations around security, monitoring, backup, and disaster recovery would be necessary.


