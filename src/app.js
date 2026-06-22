import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { checkDBHealth } from './config/db.js';
import { checkRedisHealth } from './config/redis.js';
import chatRoutes from './routes/chat.routes.js';

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ charset: 'utf-8' }));
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(morgan('dev'));

app.use('/api/chat', chatRoutes);

app.get('/health', async (req, res, next) => {
  try {
    const mongoHealth = checkDBHealth();
    const redisHealth = await checkRedisHealth();

    const deps = [mongoHealth, redisHealth];
    const overallStatus = deps.every(d => d.status === "healthy") ? "healthy" : "degraded";

    res.status(overallStatus === "healthy" ? 200 : 503).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        mongodb: mongoHealth,
        redis: redisHealth,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ChatBot Services API', version: '1.0.0' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
