const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Session Configuration
app.use(session({
    secret: 'your-secret-key', // In production, use an environment variable
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(express.static('public')); // To serve index.html, css, js
app.use('/uploads', express.static('uploads')); // To serve uploaded images

// --- Database Functions ---
const readDB = () => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database file:', error);
        // If file doesn't exist or is empty, return a default structure
        return { projects: [] };
    }
};

const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing to database file:', error);
    }
};

// --- Admin Credentials (Hardcoded for simplicity) ---
const ADMIN_USER = { username: 'admin', password: 'password' };

// --- Auth Middleware ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        res.status(401).json({ message: 'Unauthorized: You must be logged in.' });
    }
};

// --- Multer Setup for Image Uploads ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    }
});
const upload = multer({ storage: storage });

// --- Auth API Routes ---

app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, username: req.session.user.username });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
        req.session.user = { username: ADMIN_USER.username };
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out.' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});


// --- Project API Routes ---

// GET all projects
app.get('/api/projects', (req, res) => {
    const db = readDB();
    res.json(db.projects || []);
});

// POST a new project
app.post('/api/projects', isAuthenticated, upload.single('image'), (req, res) => {
    const db = readDB();
    const { title, category, description, tech, url } = req.body;

    if (!title || !category || !description) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const newProject = {
        id: Date.now(),
        title,
        category,
        description,
        tech: tech ? tech.split(',').map(t => t.trim()).filter(t => t) : [],
        url: url || '',
        image: req.file ? `/uploads/${req.file.filename}` : null, // Path to the uploaded image
        createdAt: new Date()
    };

    db.projects.push(newProject);
    writeDB(db);
    res.status(201).json(newProject);
});

// PUT (update) a project
app.put('/api/projects/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const db = readDB();
    const projectId = parseInt(req.params.id, 10);
    const projectIndex = db.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ message: 'Project not found' });
    }

    const { title, category, description, tech, url } = req.body;
    const updatedProject = { ...db.projects[projectIndex] };

    if (title) updatedProject.title = title;
    if (category) updatedProject.category = category;
    if (description) updatedProject.description = description;
    if (tech) updatedProject.tech = tech.split(',').map(t => t.trim()).filter(t => t);
    if (url) updatedProject.url = url;
    if (req.file) {
        // Optional: delete old image if it exists
        const oldImagePath = db.projects[projectIndex].image;
        if (oldImagePath) {
            fs.unlink(path.join(__dirname, oldImagePath), err => {
                if (err) console.error("Failed to delete old image:", err);
            });
        }
        updatedProject.image = `/uploads/${req.file.filename}`;
    }

    db.projects[projectIndex] = updatedProject;
    writeDB(db);
    res.json(updatedProject);
});

// DELETE a project
app.delete('/api/projects/:id', isAuthenticated, (req, res) => {
    const db = readDB();
    const projectId = parseInt(req.params.id, 10);
    const projectIndex = db.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
        return res.status(404).json({ message: 'Project not found' });
    }

    // Delete the image file if it exists
    const imagePath = db.projects[projectIndex].image;
    if (imagePath) {
        fs.unlink(path.join(__dirname, imagePath), err => {
            if (err) console.error("Failed to delete image:", err);
        });
    }

    db.projects.splice(projectIndex, 1);
    writeDB(db);
    res.status(204).send(); // No content
});

// --- Serve Frontend ---
// A catch-all route to serve the main index.html for any other request
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
