// server.js 
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Get PORT from environment variable (Render provides this)
const PORT = process.env.PORT || 5000;

// Define upload directory
const UPLOAD_DIR = 'uploads/'; 

// Get the base URL from environment variable or use localhost for development
const SERVER_BASE_URL = process.env.RENDER_EXTERNAL_URL 
    ? `https://${process.env.RENDER_EXTERNAL_URL}/public/`
    : `http://localhost:${PORT}/public/`;

// --- Ensure upload directory exists ---
if (!fs.existsSync(UPLOAD_DIR)){
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Clean filename: keep original name, add unique suffix
        const originalName = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        const safeFileName = originalName.replace(/[^a-zA-Z0-9]/g, '-');
        cb(null, safeFileName + '-' + uniqueSuffix + extension);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// --- Middleware ---
// Configure CORS to allow your Vercel frontend
// In your server.js, replace the generic `app.use(cors());` with:
const cors = require('cors');

const corsOptions = {
  origin: [
    'https://flip-book-frontend.vercel.app', // Your live frontend
    'https://flip-book-frontend-byswtmnk6-book-buddys-projects-7b4dd408.vercel.app', // Preview deployments
    'http://localhost:5173' // For local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
};

app.use(cors(corsOptions));

// Parse JSON and urlencoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Serve uploaded files publicly
app.use('/public', express.static(path.join(__dirname, UPLOAD_DIR), {
    setHeaders: (res, path) => {
        // Set CORS headers for static files too
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// --- Health Check Endpoint ---
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'BookBuddy PDF Flipbook Server is running',
        timestamp: new Date().toISOString(),
        baseUrl: SERVER_BASE_URL
    });
});

// --- API Endpoint ---
app.post('/api/upload-pdf', upload.single('bookbuddy'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No PDF file uploaded or invalid file type.' 
            });
        }

        // Construct the public URL for the uploaded file
        const publicFileUrl = `${SERVER_BASE_URL}${req.file.filename}`;
        
        console.log('File uploaded successfully:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            publicFileUrl: publicFileUrl
        });

        res.json({
            success: true,
            message: 'File uploaded successfully.',
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            publicFileUrl: publicFileUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during upload',
            error: error.message
        });
    }
}, (error, req, res, next) => {
    // Error handling middleware for Multer
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 50MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${error.message}`
        });
    } else if (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next();
});

// --- Test Endpoint to verify server is working ---
app.get('/api/test', (req, res) => {
    res.json({
        message: 'BookBuddy Backend is operational',
        serverBaseUrl: SERVER_BASE_URL,
        environment: process.env.NODE_ENV || 'development',
        uploadDir: UPLOAD_DIR
    });
});

// --- 404 Handler ---
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found. Available endpoints: /api/upload-pdf, /api/health, /api/test'
    });
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
    console.log(`🌐 Server Base URL: ${SERVER_BASE_URL}`);
    console.log(`📤 Upload endpoint: ${SERVER_BASE_URL.replace('/public/', '')}/api/upload-pdf`);
    console.log(`💪 Health check: ${SERVER_BASE_URL.replace('/public/', '')}/api/health`);
    console.log(`🔍 Test endpoint: ${SERVER_BASE_URL.replace('/public/', '')}/api/test`);
    console.log(`🎯 CORS enabled for:`);
    console.log(`   - https://flip-book-frontend.vercel.app`);
    console.log(`   - https://flip-book-frontend-byswtmnk6-book-buddys-projects-7b4dd408.vercel.app`);
    console.log(`   - http://localhost:5173`);
});