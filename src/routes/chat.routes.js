import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

router.post('/', optionalAuth, chatController.sendMessage);

router.get('/', authenticate, chatController.listUserSessions);

router.get('/trending', chatController.getTrending);

router.get('/price-insights', chatController.getPriceInsights);

router.get('/:sessionId', optionalAuth, chatController.getHistory);

router.delete('/:sessionId', authenticate, chatController.deleteSession);

export default router;
