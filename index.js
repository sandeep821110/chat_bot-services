import 'dotenv/config';
import app from './src/app.js';
import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { connectRedis } from './src/config/redis.js';

const PORT = process.env.PORT || 5001;

const start = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('CHATBOT SERVICES - INITIALIZATION');
  console.log('='.repeat(60));

  await connectDB();
  await connectRedis();

  const server = app.listen(PORT, () => {
    console.log('\n' + '-'.repeat(60));
    console.log(`ChatBot service running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Chat:   POST http://localhost:${PORT}/api/chat`);
    console.log('-'.repeat(60) + '\n');
  });

  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err.message);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    server.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });
};

start();
