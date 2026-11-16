import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import tagRoutes from './routes/tagRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import filterRoutes from './routes/filterRoutes.js';
import timeTrackingRoutes from './routes/timeTrackingRoutes.js';
import dependencyRoutes from './routes/dependencyRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import erdRoutes from './routes/erdRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureActivityTableExists } from './services/activityService.js';
import { ensureTagTablesExist } from './services/tagService.js';
import { ensureTeamTableExists } from './services/teamService.js';
import { ensureAuthTablesExist } from './services/authService.js';
import { ensureDependencyTableExists } from './services/dependencyService.js';
import { ensureVersionTableExists } from './services/versionService.js';
import { ensureErdTablesExist } from './services/erdService.js';
import { ensureSchemaVersionTablesExist } from './services/schemaVersionService.js';
import { ensureComplianceTablesExist } from './services/complianceService.js';
import { ensureMarketplaceTablesExist } from './services/marketplaceService.js';
import { initSocketServer } from './services/socketService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Ensure database tables exist on boot (Pure SQL auto-migration)
ensureAuthTablesExist();
ensureActivityTableExists();
ensureTagTablesExist();
ensureTeamTableExists();
ensureDependencyTableExists();
ensureVersionTableExists();
ensureErdTablesExist();
ensureSchemaVersionTablesExist();
ensureComplianceTablesExist();
ensureMarketplaceTablesExist();

// Middleware
app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NexusFlow API with OAuth & Agile Architecture Engine',
    timestamp: new Date().toISOString(),
  });
});

// RESTful Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api', invitationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/issues', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api', timeTrackingRoutes);
app.use('/api', dependencyRoutes);
app.use('/api', requirementRoutes);
app.use('/api', erdRoutes);

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Endpoint Not Found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start HTTP & WebSocket Server
const httpServer = http.createServer(app);
initSocketServer(httpServer);

const server = httpServer.listen(PORT, () => {
  console.log(`🚀 NexusFlow Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth Endpoints: http://localhost:${PORT}/api/auth/users`);
});

server.on('error', (err) => {
  if (err.code === 'EACCES') {
    console.error(`❌ Port ${PORT} is restricted by Windows system or requires elevated permissions.`);
    console.error(`💡 Try changing PORT to 5001 or 5050 in Backend/.env`);
  } else if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
  } else {
    console.error('❌ Server startup error:', err);
  }
});
