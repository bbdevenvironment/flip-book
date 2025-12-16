// api/index.js (Express Backend for Vercel with Neon/Postgres Integration)

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
// Import Vercel Blob and Vercel Postgres (relies on POSTGRES_URL env var)
const { put } = require('@vercel/blob'); 
const { sql } = require('@vercel/postgres'); 

const app = express();

// ********************************************
// SERVERLESS CONFIGURATION
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
// MAIN UPLOAD ENDPOINT (Saves link to DB)
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

            // 2. SAVE link to Postgres (using POSTGRES_URL/Neon connection)
            await sql`
                INSERT INTO flipbook_links (filename, blob_url) 
                VALUES (${filename}, ${blob.url})
                ON CONFLICT (filename) DO UPDATE SET blob_url = EXCLUDED.blob_url;
            `;

        } catch (error) {
            console.error('Upload or Database Error:', error);
            // In a production app, you would add logic here to delete the Blob if the DB save fails.
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
            SELECT blob_url FROM flipbook_links WHERE filename = ${filename} LIMIT 1;
        `;

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: `File not found for ID: ${filename}` });
        }

        const blobUrl = result.rows[0].blob_url;
        
        res.json({
            success: true,
            publicFileUrl: blobUrl,
            filename: filename
        });

    } catch (error) {
        console.error('Database lookup error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during database lookup.' });
    }
});
// ********************************************

// Health Check Endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection by selecting a simple constant
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


// ... (Root endpoint, 404, and Error Handling remain the same) ...

module.exports = app;