import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot_services';

export const connectDB = async () => {
  if (!MONGO_URI) {
    console.warn('MONGO_URI not set, running without database');
    return null;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.warn('MongoDB connection failed, running without database:', err.message);
    return null;
  }
};

export const isMongoReady = () => mongoose.connection.readyState === 1;
