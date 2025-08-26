const express = require('express');
const multer = require('multer');
const cloudinary = require('../cloudinary');
const fs = require('fs');
const Message = require('../models/Message');
const auth = require('../middleware/auth');

const router = express.Router();

// Multer temporary storage
const upload = multer({ dest: 'uploads/' });

// Send message (with optional file)
router.post('/send', [auth, upload.single('file')], async (req, res) => {
    try {
        const { receiver, content } = req.body;
        let fileUrl = '';

        if (req.file) {
            // Upload to Cloudinary with resource_type: auto
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'mern-chat/files',
                resource_type: 'auto', // ensures PDF, DOCX, MP4, etc. are accessible
            });
            fileUrl = result.secure_url;

            // Delete temporary file
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });
        }

        const message = new Message({
            sender: req.user.id,
            receiver,
            content,
            fileUrl
        });

        await message.save();
        res.json(message);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get chat history
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
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;
