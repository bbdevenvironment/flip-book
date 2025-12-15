// server.js 
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const UPLOAD_DIR = 'uploads/'; 
const SERVER_BASE_URL = `http://localhost:${PORT}/public/`; 

// --- Configuration ---
if (!fs.existsSync(UPLOAD_DIR)){
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
    }
});

// --- Middleware ---

// This allows frontend (5173) to talk to backend (5000)
app.use(cors()); 

// CRITICAL: This serves the files publicly
app.use('/public', express.static(path.join(__dirname, UPLOAD_DIR)));

// --- API Endpoint ---
app.post('/api/upload-pdf', upload.single('bookbuddy'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No PDF file uploaded or invalid file type.' });
    }

    res.json({
        message: 'File uploaded successfully.',
        filename: req.file.filename,
        publicFileUrl: SERVER_BASE_URL + req.file.filename
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});