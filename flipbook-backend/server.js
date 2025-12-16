// server.js (Express Backend for Vercel)

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
// Vercel Blob SDK for cloud storage
const { put } = require('@vercel/blob'); 

const app = express();
const PORT = process.env.PORT || 5000;

// ********************************************
// SERVERLESS FILE STORAGE CONFIGURATION
// Multer uses memoryStorage to keep files in memory (safe for Vercel)
// ********************************************
const storage = multer.memoryStorage();
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
// ********************************************

// Define your frontend URL dynamically from the environment
// Defaults to the deployed frontend URL for safety if env var is missing
const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'https://flip-book-frontend.vercel.app'; 

// ********************************************
// CORS FIX: Explicitly allow all necessary origins
// ********************************************
const CORS_ALLOWED_ORIGINS = [
    FRONTEND_BASE_URL,
    'https://flip-book-frontend.vercel.app', // Explicitly allow deployed frontend
    'http://localhost:5173', // For local Vite/React development
    'http://localhost:3000' // For local Create-React-App development
];

const corsOptions = {
  origin: CORS_ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'] // Important: OPTIONS is for the CORS preflight check
};

app.use(cors(corsOptions));
// ********************************************

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function to get base URL 
const getBaseUrl = (req) => {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};

// Health Check Endpoint (For monitoring deployment status)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'BookBuddy Vercel Blob Server is running.',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ********************************************
// MAIN UPLOAD ENDPOINT
// ********************************************
app.post('/api/upload-pdf', (req, res) => {
    
    // Use Multer to parse the file into req.file.buffer
    upload.single('bookbuddy')(req, res, async (err) => { 
        if (err) {
            // Handle Multer file size, file type, or other upload errors
            const errorMessage = err.message || 'File upload failed.';
            console.error('Upload error:', errorMessage);
            return res.status(400).json({ success: false, message: errorMessage });
        }

        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No PDF file uploaded. Field name must be "bookbuddy".' 
            });
        }

        const file = req.file;
        let blob;

        try {
            // Create a safe and unique filename
            const originalName = path.parse(file.originalname).name;
            const extension = path.extname(file.originalname);
            const safeName = originalName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50);
            const fileName = `${safeName}-${Date.now()}${extension}`;

            // Upload the file buffer to Vercel Blob (token is picked up automatically from env)
            blob = await put(fileName, file.buffer, {
                access: 'public', // Set access to public
                contentType: file.mimetype,
                addRandomSuffix: false 
            });

        } catch (blobError) {
            console.error('Vercel Blob Upload Failed:', blobError);
            return res.status(500).json({
                success: false,
                message: 'Failed to save file to cloud storage. Check BLOB_READ_WRITE_TOKEN and Vercel Blob connection.'
            });
        }
        
        // Success response with the permanent public URL and the filename (ID)
        res.json({
            success: true,
            message: 'File uploaded successfully.',
            filename: blob.pathname, 
            publicFileUrl: blob.url, // This is the permanent URL for react-pdf
            shareableUrl: `${FRONTEND_BASE_URL}/?file=${blob.pathname}` // URL for sharing
        });
    });
});
// ********************************************

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'BookBuddy PDF Flipbook API (Vercel Blob Integrated)',
        endpoints: {
            upload: 'POST /api/upload-pdf',
            health: 'GET /api/health'
        }
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        requestedUrl: req.url,
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});


// Start Server (Used for local development only)
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// IMPORTANT: For Vercel, this file must export the app instance.
module.exports = app;