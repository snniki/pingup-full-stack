import express from 'express';
import { getChatMessages, getConversationSummaries, sendMessage, sseController } from '../controllers/messageController.js';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';


const messageRouter = express.Router();

messageRouter.get('/conversations', protect, getConversationSummaries)
messageRouter.post('/send', upload.single('image'), protect, sendMessage)
messageRouter.post('/get', protect, getChatMessages)
messageRouter.get('/:userId', sseController)

export default messageRouter
