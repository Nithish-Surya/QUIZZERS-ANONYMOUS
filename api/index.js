const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// ─── MongoDB Connection ───────────────────────────────────
let isConnected = false;

async function connectDB() {
    if (isConnected) return;

    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;

    console.log('MongoDB Atlas connected ✅');
}

// ─── Schemas ─────────────────────────────────────────────

const userSchema = new mongoose.Schema({
    userId: {
        type: Number,
        unique: true
    },

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    qid: {
        type: Number,
        default: 0
    },

    events: [
        {
            event_name: {
                type: String
            },

            status: {
                type: Number,
                default: 0
            }
        }
    ]
});

const eventSchema = new mongoose.Schema({
    event_name: {
        type: String,
        required: true,
        unique: true
    }
});

// ─── Counter Schema ───────────────────────────────────────
// Used to generate sequential user IDs starting from 1000

const counterSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true
    },

    value: {
        type: Number,
        default: 999
    }
});

const User = mongoose.models.User ||
    mongoose.model('User', userSchema);

const Event = mongoose.models.Event ||
    mongoose.model('Event', eventSchema);

const Counter = mongoose.models.Counter ||
    mongoose.model('Counter', counterSchema);


// ─── Generate Sequential User ID ──────────────────────────

async function generateUserId() {
    const counter = await Counter.findOneAndUpdate(
        { name: 'userId' },

        // Increment counter by 1
        { $inc: { value: 1 } },

        {
            new: true,
            upsert: true
        }
    );

    return counter.value;
}


// ─── Middleware: connect DB before every request ──────────

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({
            error: 'Database connection failed!'
        });
    }
});


// ─── Routes ──────────────────────────────────────────────


// ─── Register ────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
    try {

        // Generate sequential ID
        // First user = 1000
        // Second user = 1001
        // Third user = 1002
        const userId = await generateUserId();

        const user = new User({
            userId,

            name: req.body.name,

            email: req.body.email,

            password: req.body.password,

            qid: 0,

            events: []
        });

        await user.save();

        res.json({
            message: 'Registered successfully!',
            userId,
            name: req.body.name
        });

    } catch (err) {

        if (err.code === 11000) {

            res.status(400).json({
                error: 'Email already exists!'
            });

        } else {

            res.status(500).json({
                error: err.message
            });

        }
    }
});


// ─── Login ───────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
    try {

        const { email, password } = req.body;

        // Admin login
        if (
            email === "admin@qa.com" &&
            password === "pepperhoney"
        ) {
            return res.json({
                role: "admin",
                message: "Admin login successful!"
            });
        }

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                error: 'Email not found!'
            });
        }

        // Check password
        if (user.password !== password) {
            return res.status(400).json({
                error: 'Wrong password!'
            });
        }

        res.json({
            role: "user",
            message: 'Login successful!',
            userId: user.userId,
            name: user.name
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Save Events ─────────────────────────────────────────

app.post('/api/save-events', async (req, res) => {
    try {

        const { userId, events } = req.body;

        const user = await User.findOneAndUpdate(
            { userId },
            { events },
            { new: true }
        );

        if (!user) {
            return res.status(400).json({
                error: 'User not found!'
            });
        }

        res.json({
            message: 'Events saved successfully!',
            events: user.events
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Get User ────────────────────────────────────────────

app.get('/api/get-user', async (req, res) => {
    try {

        const user = await User.findOne({
            userId: parseInt(req.query.userId)
        });

        if (!user) {
            return res.status(400).json({
                error: 'User not found!'
            });
        }

        res.json({
            name: user.name,
            userId: user.userId,
            events: user.events
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Get All Users ───────────────────────────────────────

app.get('/api/get-all-users', async (req, res) => {
    try {

        const users = await User.find(
            {},
            { password: 0 }
        );

        res.json({
            users
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Update Event Status ─────────────────────────────────

app.post('/api/update-event-status', async (req, res) => {
    try {

        const {
            userId,
            event_name,
            status
        } = req.body;

        const user = await User.findOne({
            userId
        });

        if (!user) {
            return res.status(400).json({
                error: 'User not found!'
            });
        }

        const event = user.events.find(
            e => e.event_name === event_name
        );

        if (!event) {
            return res.status(400).json({
                error: 'Event not found!'
            });
        }

        event.status = status;

        await user.save();

        res.json({
            message: 'Score updated successfully!',
            events: user.events
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Get Events ───────────────────────────────────────────

app.get('/api/get-events', async (req, res) => {
    try {

        const events = await Event.find({});

        res.json({
            events
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Add Event ───────────────────────────────────────────

app.post('/api/add-event', async (req, res) => {
    try {

        const { event_name } = req.body;

        const event = new Event({
            event_name
        });

        await event.save();

        res.json({
            message: 'Event added successfully!',
            event
        });

    } catch (err) {

        if (err.code === 11000) {

            res.status(400).json({
                error: 'Event already exists!'
            });

        } else {

            res.status(500).json({
                error: err.message
            });

        }
    }
});


// ─── Delete Event ─────────────────────────────────────────

app.post('/api/delete-event', async (req, res) => {
    try {

        const { event_name } = req.body;

        await Event.findOneAndDelete({
            event_name
        });

        res.json({
            message: 'Event deleted successfully!'
        });

    } catch (err) {

        res.status(500).json({
            error: err.message
        });

    }
});


// ─── Export for Vercel ────────────────────────────────────
// No app.listen() needed

module.exports = app;
