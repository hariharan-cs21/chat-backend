const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../cloudinary');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Multer Cloudinary storage for profile photo
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'mern-chat/profile_photos',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [{ width: 256, height: 256, crop: 'limit' }],
    },
});
const upload = multer({ storage });

// Register (with optional profile photo)
router.post('/register', upload.single('photo'), async (req, res) => {
    try {
        let { username, email, password } = req.body;
        // If sent as JSON, req.body is parsed; if as FormData, fields are strings
        if (!username || !email || !password) {
            return res.status(400).json({ msg: 'username, email, and password are required' });
        }
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });
        let profilePhoto = '';
        if (req.file && req.file.path) {
            profilePhoto = req.file.path;
        }
        user = new User({
            username,
            email,
            password: await bcrypt.hash(password, 10),
            profilePhoto
        });
        await user.save();
        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Upload profile photo
router.post('/profile-photo', [auth, upload.single('photo')], async (req, res) => {
    try {
        let profilePhoto = '';
        if (req.file && req.file.path) {
            profilePhoto = req.file.path;
        }
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profilePhoto },
            { new: true }
        );
        res.json(user);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Get all users (for chat list)
router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
