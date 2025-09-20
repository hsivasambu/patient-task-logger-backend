\# Patient Task Tracker - Backend API



A RESTful API for healthcare professionals to manage patient tasks and medical record logging. Built with Node.js, Express, and PostgreSQL with a focus on system design principles and scalability.



\## 🚀 Quick Start



\### Prerequisites

\- Node.js (v18+ recommended)

\- PostgreSQL (v13+ recommended)

\- Docker (optional)



\### Installation

```bash

\# Clone the repository

git clone \[repository-url]

cd patient-tracker-backend



\# Install dependencies

npm install



\# Set up environment variables

cp .env.example .env

\# Edit .env with your database credentials



\# Initialize database

npm run db:init



\# Start development server

npm run dev

```



\### Available Scripts

```bash

npm run dev          # Start development server with nodemon

npm start            # Start production server

npm run db:init      # Initialize database tables

npm run db:seed      # Seed database with sample data

npm test             # Run test suite

npm run lint         # Run ESLint

npm run docker:up    # Start with Docker Compose

```



\## 📁 Project Structure



```

src/

├── config/              # Configuration files

│   ├── database.js      # Database connection setup

│   ├── auth.js          # JWT configuration

│   └── cors.js          # CORS settings

├── controllers/         # Request handlers

│   ├── authController.js    # Authentication logic

│   ├── patientController.js # Patient CRUD operations

│   └── taskController.js    # Task logging operations

├── middleware/          # Express middleware

│   ├── auth.js          # JWT authentication middleware

│   ├── rbac.js          # Role-based access control

│   ├── validation.js    # Input validation

│   └── errorHandler.js  # Global error handling

├── models/              # Database models

│   ├── User.js          # User/Clinician model

│   ├── Patient.js       # Patient model

│   └── TaskLog.js       # Task logging model

├── routes/              # API route definitions

│   ├── auth.js          # Authentication routes

│   ├── patients.js      # Patient management routes

│   └── taskLogs.js      # Task logging routes

├── services/            # Business logic layer

│   ├── authService.js   # Authentication business logic

│   ├── patientService.js # Patient management logic

│   └── taskService.js   # Task logging logic

├── utils/               # Utility functions

│   ├── logger.js        # Winston logging setup

│   ├── validators.js    # Input validation helpers

│   └── constants.js     # Application constants

├── database/            # Database management

│   ├── migrations/      # SQL migration files

│   ├── seeds/           # Sample data

│   └── init.sql         # Initial schema

└── app.js               # Express application setup

```



\## 🏗️ System Design \& Architecture



\### Core Design Principles



\*\*1. RESTful API Design\*\*

\- Consistent URL patterns following REST conventions

\- Proper HTTP status codes and methods

\- Stateless request handling

\- Resource-based URL structure



```javascript

// RESTful endpoint examples

GET    /api/patients              # List all patients

POST   /api/patients              # Create new patient

GET    /api/patients/:id          # Get specific patient

PUT    /api/patients/:id          # Update patient

DELETE /api/patients/:id          # Delete patient

GET    /api/patients/:id/tasks    # Get patient's tasks

POST   /api/task-logs             # Create task log entry

```



\*\*2. Database Schema Design\*\*

Normalized relational database design with proper foreign key relationships:



```sql

-- Core entities with audit trails

Users (id, email, password\_hash, role, created\_at, updated\_at)

Patients (id, mrn, first\_name, last\_name, room\_number, created\_at)

TaskLogs (id, patient\_id, user\_id, task\_type, description, completed\_at)



-- Indexing strategy for performance

CREATE INDEX idx\_patients\_mrn ON patients(medical\_record\_number);

CREATE INDEX idx\_task\_logs\_patient ON task\_logs(patient\_id);

CREATE INDEX idx\_task\_logs\_created ON task\_logs(completed\_at);

```



\*\*3. Authentication \& Authorization Architecture\*\*

\- JWT-based stateless authentication

\- Role-based access control (RBAC)

\- Password hashing with bcrypt

\- Token expiration and refresh strategies



```javascript

// JWT middleware implementation

const authMiddleware = (req, res, next) => {

&nbsp; const token = req.header('Authorization')?.replace('Bearer ', '');

&nbsp; if (!token) return res.status(401).json({ error: 'Access denied' });

&nbsp; 

&nbsp; try {

&nbsp;   const decoded = jwt.verify(token, process.env.JWT\_SECRET);

&nbsp;   req.user = decoded;

&nbsp;   next();

&nbsp; } catch (error) {

&nbsp;   res.status(400).json({ error: 'Invalid token' });

&nbsp; }

};

```



\## 🔧 API Endpoints



\### Authentication

```bash

POST /api/auth/register     # Register new clinician

POST /api/auth/login        # Authenticate user

GET  /api/auth/profile      # Get current user profile

```



\### Patient Management

```bash

GET    /api/patients        # List all patients (paginated)

POST   /api/patients        # Create new patient

GET    /api/patients/:id    # Get patient details

PUT    /api/patients/:id    # Update patient information

DELETE /api/patients/:id    # Delete patient (admin only)

```



\### Task Logging

```bash

GET  /api/task-logs                    # List all task logs

POST /api/task-logs                    # Create new task log

GET  /api/task-logs/patient/:id        # Get tasks for specific patient

GET  /api/task-logs/clinician/:id      # Get tasks by clinician

```



\### Request/Response Examples



\*\*Create Patient:\*\*

```javascript

POST /api/patients

{

&nbsp; "firstName": "John",

&nbsp; "lastName": "Doe",

&nbsp; "medicalRecordNumber": "MRN-12345",

&nbsp; "roomNumber": "203A",

&nbsp; "dateOfBirth": "1985-06-15"

}

```



\*\*Log Task:\*\*

```javascript

POST /api/task-logs

{

&nbsp; "patientId": 1,

&nbsp; "taskType": "medication",

&nbsp; "description": "Administered insulin 10 units subcutaneous",

&nbsp; "notes": "Patient tolerated well, no adverse reactions"

}

```



\## 🎯 System Design Concepts Implemented



\### 1. Separation of Concerns

\- \*\*Controllers\*\*: Handle HTTP requests/responses

\- \*\*Services\*\*: Business logic and data processing

\- \*\*Models\*\*: Data access and database interactions

\- \*\*Middleware\*\*: Cross-cutting concerns (auth, validation, logging)



\### 2. Error Handling Strategy

```javascript

// Centralized error handling middleware

const errorHandler = (err, req, res, next) => {

&nbsp; logger.error(err.stack);

&nbsp; 

&nbsp; if (err.type === 'validation') {

&nbsp;   return res.status(400).json({ error: err.message });

&nbsp; }

&nbsp; 

&nbsp; if (err.code === '23505') { // Postgres unique violation

&nbsp;   return res.status(409).json({ error: 'Resource already exists' });

&nbsp; }

&nbsp; 

&nbsp; res.status(500).json({ error: 'Internal server error' });

};

```



\### 3. Input Validation \& Sanitization

```javascript

// Joi validation schemas

const patientSchema = Joi.object({

&nbsp; firstName: Joi.string().min(2).max(50).required(),

&nbsp; lastName: Joi.string().min(2).max(50).required(),

&nbsp; medicalRecordNumber: Joi.string().pattern(/^MRN-\\d+$/).required(),

&nbsp; roomNumber: Joi.string().max(10).allow(null)

});

```



\### 4. Database Connection Management

```javascript

// Connection pooling for scalability

const pool = new Pool({

&nbsp; host: process.env.DB\_HOST,

&nbsp; port: process.env.DB\_PORT,

&nbsp; database: process.env.DB\_NAME,

&nbsp; user: process.env.DB\_USER,

&nbsp; password: process.env.DB\_PASSWORD,

&nbsp; max: 20,          // Maximum connections in pool

&nbsp; idleTimeoutMillis: 30000,

&nbsp; connectionTimeoutMillis: 2000,

});

```



\## 📈 Scaling Considerations (1 Clinic → 10 Hospitals)



\### Current Architecture (Single Clinic)

```

\[Client] → \[Load Balancer] → \[API Server] → \[PostgreSQL]

&nbsp;                               ↓

&nbsp;                          \[Redis Cache]

```



\### Multi-Hospital Architecture

```

\[Clients] → \[Global LB] → \[Regional APIs] → \[Hospital DBs]

&nbsp;             ↓              ↓              ↓

&nbsp;        \[CDN Cache]   \[Redis Cluster]  \[Read Replicas]

```



\### 1. Data Architecture Evolution



\*\*Multi-Tenancy Implementation:\*\*

```javascript

// Hospital-scoped data access

const getPatientsByHospital = async (hospitalId, userId) => {

&nbsp; const query = `

&nbsp;   SELECT p.\* FROM patients p

&nbsp;   JOIN users u ON u.hospital\_id = $1

&nbsp;   WHERE u.id = $2 AND p.hospital\_id = $1

&nbsp; `;

&nbsp; return await pool.query(query, \[hospitalId, userId]);

};

```



\*\*Database Partitioning Strategy:\*\*

```sql

-- Partition by hospital\_id for better performance

CREATE TABLE task\_logs\_hospital\_1 PARTITION OF task\_logs

FOR VALUES IN (1);



CREATE TABLE task\_logs\_hospital\_2 PARTITION OF task\_logs

FOR VALUES IN (2);

```



\### 2. Performance Optimization



\*\*Read Replicas for Geographic Distribution:\*\*

```javascript

const masterDB = new Pool({ host: 'master.hospital.com' });

const replicaDB = new Pool({ host: 'replica-west.hospital.com' });



const executeQuery = async (query, params, isWrite = false) => {

&nbsp; const db = isWrite ? masterDB : replicaDB;

&nbsp; return await db.query(query, params);

};

```



\*\*Caching Strategy with Redis:\*\*

```javascript

// Hospital-scoped caching

const getCachedPatients = async (hospitalId) => {

&nbsp; const cacheKey = `hospital:${hospitalId}:patients`;

&nbsp; const cached = await redis.get(cacheKey);

&nbsp; 

&nbsp; if (cached) return JSON.parse(cached);

&nbsp; 

&nbsp; const patients = await patientService.getByHospital(hospitalId);

&nbsp; await redis.setex(cacheKey, 300, JSON.stringify(patients));

&nbsp; return patients;

};

```



\### 3. Horizontal Scaling Architecture



\*\*Load Balancing Configuration:\*\*

```nginx

\# nginx.conf for hospital routing

upstream hospital\_1\_api {

&nbsp;   server api-h1-1:3000;

&nbsp;   server api-h1-2:3000;

&nbsp;   server api-h1-3:3000;

}



upstream hospital\_2\_api {

&nbsp;   server api-h2-1:3000;

&nbsp;   server api-h2-2:3000;

}



location /api/hospital/1/ {

&nbsp;   proxy\_pass http://hospital\_1\_api;

}

```



\*\*Container Orchestration:\*\*

```yaml

\# docker-compose.production.yml

version: '3.8'

services:

&nbsp; api-hospital-1:

&nbsp;   image: patient-tracker:latest

&nbsp;   environment:

&nbsp;     - HOSPITAL\_ID=1

&nbsp;     - DB\_HOST=hospital1.db.internal

&nbsp;   deploy:

&nbsp;     replicas: 3

&nbsp;     resources:

&nbsp;       limits:

&nbsp;         memory: 512M

&nbsp;       reservations:

&nbsp;         memory: 256M

```



\### 4. Microservices Evolution



\*\*Service Decomposition Strategy:\*\*

```

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐

│   Auth Service  │  │ Patient Service │  │  Task Service   │

│                 │  │                 │  │                 │

│ - User mgmt     │  │ - Patient CRUD  │  │ - Task logging  │

│ - JWT tokens    │  │ - Medical info  │  │ - Audit trails  │

│ - RBAC          │  │ - Room mgmt     │  │ - Reporting     │

└─────────────────┘  └─────────────────┘  └─────────────────┘

&nbsp;        │                     │                     │

&nbsp;        └─────────────────────┼─────────────────────┘

&nbsp;                              │

&nbsp;                   ┌─────────────────┐

&nbsp;                   │  Event Bus      │

&nbsp;                   │  (Redis/RabbitMQ)│

&nbsp;                   └─────────────────┘

```



\## 🔒 Security Implementation



\### 1. Authentication Security

\- Password hashing with bcrypt (12 rounds)

\- JWT tokens with short expiration times

\- Secure HTTP headers with helmet.js

\- Rate limiting to prevent brute force attacks



\### 2. Data Protection

```javascript

// Input sanitization

const sanitizeInput = (input) => {

&nbsp; return validator.escape(input.toString().trim());

};



// SQL injection prevention with parameterized queries

const getPatient = async (id) => {

&nbsp; const query = 'SELECT \* FROM patients WHERE id = $1';

&nbsp; return await pool.query(query, \[id]);

};

```



\### 3. HIPAA Compliance Considerations

\- Audit logging for all data access

\- Data encryption at rest and in transit

\- Role-based access controls

\- Session management and automatic timeouts



```javascript

// Audit trail implementation

const logDataAccess = async (userId, action, resourceType, resourceId) => {

&nbsp; const query = `

&nbsp;   INSERT INTO audit\_logs (user\_id, action, resource\_type, resource\_id, timestamp)

&nbsp;   VALUES ($1, $2, $3, $4, NOW())

&nbsp; `;

&nbsp; await pool.query(query, \[userId, action, resourceType, resourceId]);

};

```



\## 🚀 Deployment \& Infrastructure



\### Docker Configuration

```dockerfile

\# Multi-stage build for production

FROM node:18-alpine AS builder

WORKDIR /app

COPY package\*.json ./

RUN npm ci --only=production



FROM node:18-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node\_modules ./node\_modules

COPY . .

EXPOSE 3000

CMD \["npm", "start"]

```



\### Environment Configuration

```bash

\# Development

NODE\_ENV=development

DATABASE\_URL=postgresql://user:password@localhost:5432/patient\_tracker

JWT\_SECRET=development-secret



\# Production

NODE\_ENV=production

DATABASE\_URL=postgresql://prod\_user:secure\_password@prod\_host:5432/patient\_tracker\_prod

JWT\_SECRET=production-jwt-secret-very-long-and-secure

```



\## 📊 Monitoring \& Observability



\### Logging Strategy

```javascript

// Winston logger configuration

const logger = winston.createLogger({

&nbsp; level: process.env.LOG\_LEVEL || 'info',

&nbsp; format: winston.format.combine(

&nbsp;   winston.format.timestamp(),

&nbsp;   winston.format.errors({ stack: true }),

&nbsp;   winston.format.json()

&nbsp; ),

&nbsp; transports: \[

&nbsp;   new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),

&nbsp;   new winston.transports.File({ filename: 'logs/combined.log' })

&nbsp; ]

});

```



\### Health Checks

```javascript

// Comprehensive health check endpoint

app.get('/health', async (req, res) => {

&nbsp; try {

&nbsp;   // Database connectivity check

&nbsp;   await pool.query('SELECT 1');

&nbsp;   

&nbsp;   // Redis connectivity check (if applicable)

&nbsp;   await redis.ping();

&nbsp;   

&nbsp;   res.json({

&nbsp;     status: 'OK',

&nbsp;     timestamp: new Date().toISOString(),

&nbsp;     version: process.env.npm\_package\_version,

&nbsp;     environment: process.env.NODE\_ENV

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   res.status(503).json({

&nbsp;     status: 'ERROR',

&nbsp;     message: error.message

&nbsp;   });

&nbsp; }

});

```



\## 🧪 Testing Strategy



\### Test Structure

```

tests/

├── unit/                # Unit tests for individual functions

├── integration/         # API endpoint integration tests

├── load/               # Performance and load testing

└── fixtures/           # Test data and mocks

```



\### Testing Implementation

```javascript

// Example integration test

describe('Patient API', () => {

&nbsp; test('POST /api/patients creates new patient', async () => {

&nbsp;   const patientData = {

&nbsp;     firstName: 'Test',

&nbsp;     lastName: 'Patient',

&nbsp;     medicalRecordNumber: 'MRN-TEST-001'

&nbsp;   };

&nbsp;   

&nbsp;   const response = await request(app)

&nbsp;     .post('/api/patients')

&nbsp;     .set('Authorization', `Bearer ${validToken}`)

&nbsp;     .send(patientData)

&nbsp;     .expect(201);

&nbsp;     

&nbsp;   expect(response.body).toHaveProperty('id');

&nbsp;   expect(response.body.firstName).toBe('Test');

&nbsp; });

});

```





---



\*\*Backend Version\*\*: 1.0.0  

\*\*Node.js Version\*\*: 18.x  

\*\*PostgreSQL Version\*\*: 13.x  

\*\*Last Updated\*\*: September 2025



This Patient Task Tracker backend demonstrates production-ready system design patterns and provides a solid foundation for scaling from a single clinic to a multi-hospital healthcare management system.

