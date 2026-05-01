import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

// Create an empty object to store SS Event connections
const connections = {}; 
const messagePopulate = [
    { path: 'from_user_id', select: 'full_name username profile_picture' },
    { path: 'to_user_id', select: 'full_name username profile_picture' },
];

const populateMessageQuery = (query) => query.populate(messagePopulate);

// Controller function for the SSE endpoint
export const sseController = (req, res)=>{
    const { userId } = req.params
    console.log('New client connected : ', userId)

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Add the client's response object to the connections object
    connections[userId] = res

    // Send an initial event to the client
    res.write('log: Connected to SSE stream\n\n');

    // Handle client disconnection
    req.on('close', ()=>{
        // Remove the client's response object from the connections array
        delete connections[userId];
        console.log('Client disconnected');
    })
}

// Send Message
export const sendMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, text } = req.body;
        const image = req.file;

        let media_url = '';
        let message_type = image ? 'image' : 'text';

        if(message_type === 'image'){
            const fileBuffer =  fs.readFileSync(image.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname,
            });
            media_url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    {format: 'webp'},
                    {width: '1280'}
                ]
            })
        }

        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url
        })

        const messageWithUserData = await populateMessageQuery(Message.findById(message._id));
        res.json({ success: true, message: messageWithUserData });

        if(connections[to_user_id]){
           connections[to_user_id].write(`data: ${JSON.stringify(messageWithUserData)}\n\n`)
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get Chat Messages
export const getChatMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id } = req.body;

        const messages = await Message.find({
            $or: [
                {from_user_id: userId, to_user_id},
                {from_user_id: to_user_id, to_user_id: userId},
            ]
        }).sort({createdAt: 1})
        // mark messages as seen
        await Message.updateMany({from_user_id: to_user_id, to_user_id: userId}, {seen: true})

        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const getUserRecentMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        const messages = await populateMessageQuery(
            Message.find({to_user_id: userId}).sort({ createdAt: -1 })
        );

        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const getConversationSummaries = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await User.findById(userId).populate('connections', 'full_name username profile_picture bio');

        if(!user){
            return res.json({ success: false, message: 'User not found' });
        }

        const allMessages = await populateMessageQuery(
            Message.find({
                $or: [
                    { from_user_id: userId },
                    { to_user_id: userId },
                ]
            }).sort({ createdAt: -1 })
        );

        const conversationMap = new Map();

        user.connections.forEach((connectionUser) => {
            conversationMap.set(connectionUser._id, {
                user: connectionUser,
                lastMessage: null,
                unreadCount: 0,
                updatedAt: connectionUser.updatedAt || connectionUser.createdAt,
            });
        });

        allMessages.forEach((message) => {
            const fromId = typeof message.from_user_id === 'string' ? message.from_user_id : message.from_user_id?._id;
            const toId = typeof message.to_user_id === 'string' ? message.to_user_id : message.to_user_id?._id;
            const otherUser = fromId === userId ? message.to_user_id : message.from_user_id;
            const otherUserId = otherUser?._id || otherUser;

            if(!otherUserId){
                return;
            }

            if(!conversationMap.has(otherUserId)){
                conversationMap.set(otherUserId, {
                    user: otherUser,
                    lastMessage: null,
                    unreadCount: 0,
                    updatedAt: message.createdAt,
                });
            }

            const conversation = conversationMap.get(otherUserId);

            if(!conversation.lastMessage){
                conversation.lastMessage = message;
                conversation.updatedAt = message.createdAt;
            }

            if(toId === userId && !message.seen){
                conversation.unreadCount += 1;
            }
        });

        const conversations = Array.from(conversationMap.values())
            .filter((conversation) => conversation.user)
            .sort((a, b) => {
                const aDate = new Date(a.lastMessage?.createdAt || a.updatedAt || 0);
                const bDate = new Date(b.lastMessage?.createdAt || b.updatedAt || 0);
                return bDate - aDate;
            });

        res.json({ success: true, conversations });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}
