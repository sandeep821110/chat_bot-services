import ChatSession from '../models/Chat.js';
import * as chatService from '../services/chat.service.js';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../config/redis.js';
import { isMongoReady } from '../config/db.js';

const CACHE_TTL = 300;

export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId: existingSessionId, context } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const sessionId = existingSessionId || uuidv4();

    const result = await chatService.processMessage(message, { ...context, name: req.user?.name });

    if (isMongoReady()) {
      try {
        let session = await ChatSession.findOne({ sessionId });
        if (!session) {
          session = new ChatSession({
            userId: req.user?.id || null,
            sessionId,
            messages: [],
            context: context || {},
          });
        }
        session.messages.push({ role: 'user', content: message });
        session.messages.push({ role: 'assistant', content: result.text });
        session.context = { ...session.context, ...context };
        await session.save();

        const redis = getRedis();
        if (redis) {
          await redis.setEx(`chat:session:${sessionId}`, CACHE_TTL, JSON.stringify(session.toObject()));
        }
      } catch (dbErr) {
        console.warn('Chat DB save failed (non-fatal):', dbErr.message);
      }
    }

    res.json({
      success: true,
      data: { sessionId, ...result },
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ success: false, message: 'Failed to process message' });
  }
};

export const getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(`chat:session:${sessionId}`);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached) });
      }
    }

    if (!isMongoReady()) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (redis) {
      await redis.setEx(`chat:session:${sessionId}`, CACHE_TTL, JSON.stringify(session.toObject()));
    }

    res.json({ success: true, data: session });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ success: false, message: 'Failed to get chat history' });
  }
};

export const listUserSessions = async (req, res) => {
  try {
    if (!isMongoReady()) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const filter = req.user ? { userId: req.user.id } : {};
    const [sessions, total] = await Promise.all([
      ChatSession.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ChatSession.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: sessions.map(s => ({
        sessionId: s.sessionId,
        messageCount: s.messages.length,
        lastMessage: s.messages.length > 0 ? s.messages[s.messages.length - 1].content : '',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ success: false, message: 'Failed to list sessions' });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!isMongoReady()) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.userId && session.userId.toString() !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await ChatSession.deleteOne({ sessionId });

    const redis = getRedis();
    if (redis) {
      await redis.del(`chat:session:${sessionId}`);
    }

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
};

export const getTrending = async (req, res) => {
  try {
    const products = await chatService.getTrending();
    res.json({ success: true, data: { products } });
  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ success: false, message: 'Failed to get trending products' });
  }
};

export const getPriceInsights = async (req, res) => {
  try {
    const result = await chatService.getPriceInsights();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Price insights error:', err);
    res.status(500).json({ success: false, message: 'Failed to get price insights' });
  }
};
