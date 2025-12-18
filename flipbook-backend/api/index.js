// api/index.js (Express Backend for Vercel with Neon/Postgres Integration)

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
// Vercel Blob and Vercel Postgres SDK imports
const { put } = require('@vercel/blob'); 
const { sql } = require('@vercel/postgres'); 

const app = express();

// ********************************************
// SERVERLESS CONFIGURATION
// ********************************************
// Use memoryStorage for Vercel Serverless compatibility
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

// CORS: Ensures the frontend can communicate with this backend API
const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'https://flip-book-frontend.vercel.app'; 
const CORS_ALLOWED_ORIGINS = [
    FRONTEND_BASE_URL,
    'https://flip-book-frontend.vercel.app', 
    'http://localhost:5173', 
    'http://localhost:3000' 
];

const corsOptions = {
  origin: CORS_ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'] 
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ********************************************
// MAIN UPLOAD ENDPOINT (Saves link to DB for permanent sharing)
// ********************************************
app.post('/api/upload-pdf', (req, res) => {
    
    upload.single('bookbuddy')(req, res, async (err) => { 
        if (err || !req.file) {
            const errorMessage = err ? err.message : 'No PDF file uploaded. Field name must be "bookbuddy".';
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const file = req.file;
        let blob;
        let filename;

        try {
            // 1. Upload to Vercel Blob
            const originalName = path.parse(file.originalname).name;
            const extension = path.extname(file.originalname);
            const safeName = originalName.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50);
            filename = `${safeName}-${Date.now()}${extension}`;

            blob = await put(filename, file.buffer, {
                access: 'public', 
                contentType: file.mimetype,
                addRandomSuffix: false 
            });

            // 2. SAVE link to Postgres (Permanent Storage)
            await sql`
                INSERT INTO flipbook_links (filename, blob_url, uploaded_at) 
                VALUES (${filename}, ${blob.url}, NOW())
                ON CONFLICT (filename) DO UPDATE SET 
                blob_url = EXCLUDED.blob_url,
                uploaded_at = NOW();
            `;

        } catch (error) {
            console.error('Upload or Database Error:', error);
            // If the database fails, return a 500 error.
            return res.status(500).json({
                success: false,
                message: 'Failed to finalize permanent link. Database error.'
            });
        }
        
        // Success response
        res.json({
            success: true,
            message: 'File uploaded and link saved successfully.',
            filename: filename, 
            publicFileUrl: blob.url, 
            shareableUrl: `${FRONTEND_BASE_URL}/?file=${filename}` 
        });
    });
});
// ********************************************

// ********************************************
// NEW ENDPOINT: Lookup Blob URL by Filename ID (Enables permanent sharing)
// ********************************************
app.get('/api/get-pdf-url', async (req, res) => {
    const { filename } = req.query;

    if (!filename) {
        return res.status(400).json({ success: false, message: 'Missing filename query parameter.' });
    }

    try {
        const result = await sql`
            SELECT blob_url, uploaded_at FROM flipbook_links WHERE filename = ${filename} LIMIT 1;
        `;

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: `File not found for ID: ${filename}` });
        }

        const blobUrl = result.rows[0].blob_url;
        const uploadedAt = result.rows[0].uploaded_at;
        
        res.json({
            success: true,
            publicFileUrl: blobUrl,
            filename: filename,
            uploaded_at: uploadedAt
        });

    } catch (error) {
        console.error('Database lookup error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during database lookup.' });
    }
});
// ********************************************

// ********************************************
// NEW ENDPOINT: Get flipbook history
// ********************************************
app.get('/api/get-history', async (req, res) => {
    try {
        const result = await sql`
            SELECT filename, blob_url, uploaded_at 
            FROM flipbook_links 
            ORDER BY uploaded_at DESC 
            LIMIT 50;
        `;

        const history = result.rows.map(row => ({
            filename: row.filename,
            blob_url: row.blob_url,
            uploaded_at: row.uploaded_at,
            pages: 0 // Will be populated by frontend when PDF loads
        }));

        res.json({
            success: true,
            history: history
        });

    } catch (error) {
        console.error('Database history error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch history',
            error: error.message 
        });
    }
});

// Health Check Endpoint (Tests database connection)
app.get('/api/health', async (req, res) => {
    try {
        await sql`SELECT 1;`; 
        res.json({ 
            status: 'OK', 
            message: 'BookBuddy Server and Database are running.',
            db_status: 'Connected'
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Server is running but failed to connect to the database.',
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'BookBuddy PDF Flipbook API (Vercel Blob Integrated)',
        endpoints: {
            upload: 'POST /api/upload-pdf',
            lookup: 'GET /api/get-pdf-url?filename={id}',
            history: 'GET /api/get-history',
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


// VERCEL FIX: Export the app instance for Serverless compatibility
module.exports = app;