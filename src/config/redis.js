import { createClient } from 'redis';

let client = null;

export const getRedis = () => client;

export const connectRedis = async () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('REDIS_URL not set, running without Redis cache');
    return null;
  }
  try {
    client = createClient({ url });
    client.on('error', (err) => console.error('Redis error:', err.message));
    await client.connect();
    console.log('Redis connected');
    return client;
  } catch (err) {
    console.warn('Redis connection failed, running without cache:', err.message);
    return null;
  }
};

export const isRedisAvailable = () => client !== null && client.isOpen;

export const getRedisStatus = () => ({
  connected: client !== null && client.isOpen,
});

export const checkRedisHealth = async () => {
  if (!client || !client.isOpen) {
    return { status: "unhealthy", message: "Redis not connected" };
  }
  try {
    const pong = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Ping timeout")), 3000))
    ]);
    return { status: "healthy", message: pong };
  } catch (error) {
    return { status: "unhealthy", message: error.message };
  }
};
