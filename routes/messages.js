const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../cloudinary');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const router = express.Router();

// Multer Cloudinary storage for chat files
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        return {
            folder: 'mern-chat/files',
            resource_type: 'auto',
            allowed_formats: [
                'jpg', 'jpeg', 'png', 'gif',
                'pdf', 'doc', 'docx', 'txt',
                'zip', 'rar', 'mp4', 'mp3'
            ],
        };
    },
    resource_type: 'auto'
});
const upload = multer({ storage });

// Send message (with optional file)
router.post('/send', [auth, upload.single('file')], async (req, res) => {
    try {
        const { receiver, content } = req.body;
        let fileUrl = '';
        if (req.file && req.file.path) fileUrl = req.file.path;
        const message = new Message({
            sender: req.user.id,
            receiver,
            content,
            fileUrl
        });
        await message.save();
        res.json(message);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get messages between two users
router.get('/history/:userId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: req.params.userId },
                { sender: req.params.userId, receiver: req.user.id }
            ]
        }).sort('timestamp');
        res.json(messages);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
