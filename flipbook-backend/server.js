const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Define upload directory
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`Created upload directory: ${UPLOAD_DIR}`);
}

// Configure CORS
const corsOptions = {
  origin: [
    'https://flip-book-frontend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files publicly
app.use('/public', express.static(UPLOAD_DIR, {
    setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname);
        const safeFileName = originalName.replace(/[^a-zA-Z0-9]/g, '-');
        const finalFileName = safeFileName + '-' + uniqueSuffix + extension;
        console.log(`Saving file as: ${finalFileName}`);
        cb(null, finalFileName);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        console.log(`Received file: ${file.originalname}, type: ${file.mimetype}`);
        
        if (file.mimetype !== 'application/pdf') {
            console.log('Rejected: Not a PDF file');
            return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Helper function to get base URL
const getBaseUrl = (req) => {
    // For production environments (Vercel, Render, etc.)
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    // For local development
    const protocol = req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
};

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({ 
        status: 'OK', 
        message: 'BookBuddy PDF Flipbook Server is running',
        timestamp: new Date().toISOString(),
        baseUrl: baseUrl,
        environment: process.env.NODE_ENV || 'development',
        uploadDir: UPLOAD_DIR,
        endpoints: {
            upload: `${baseUrl}/api/upload-pdf`,
            publicFiles: `${baseUrl}/public/{filename}`
        }
    });
});

// Test Endpoint
app.get('/api/test', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        message: 'BookBuddy Backend is operational',
        serverTime: new Date().toISOString(),
        baseUrl: baseUrl,
        uploadEndpoint: `${baseUrl}/api/upload-pdf`,
        publicFilesUrl: `${baseUrl}/public/`,
        uploadDirectory: UPLOAD_DIR,
        availableFiles: fs.readdirSync(UPLOAD_DIR)
    });
});

// List uploaded files
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const baseUrl = getBaseUrl(req);
        
        const fileList = files.map(file => ({
            filename: file,
            url: `${baseUrl}/public/${file}`,
            size: fs.statSync(path.join(UPLOAD_DIR, file)).size,
            created: fs.statSync(path.join(UPLOAD_DIR, file)).birthtime
        }));
        
        res.json({
            success: true,
            count: files.length,
            files: fileList
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing files',
            error: error.message
        });
    }
});

// File upload endpoint
app.post('/api/upload-pdf', (req, res, next) => {
    console.log('Upload request received');
    
    // Handle the upload
    upload.single('bookbuddy')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: 'File size too large. Maximum size is 50MB.'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            console.log('No file in request');
            return res.status(400).json({ 
                success: false, 
                message: 'No PDF file uploaded. Make sure to use field name "bookbuddy" in FormData.' 
            });
        }

        const baseUrl = getBaseUrl(req);
        const publicFileUrl = `${baseUrl}/public/${req.file.filename}`;
        
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
            publicFileUrl: publicFileUrl,
            downloadUrl: `${baseUrl}/api/download/${req.file.filename}`,
            shareableUrl: `${baseUrl}/?file=${req.file.filename}`
        });
    });
});

// Download endpoint
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: 'File not found'
        });
    }
    
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).json({
                success: false,
                message: 'Error downloading file'
            });
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.json({
        message: 'BookBuddy PDF Flipbook API',
        version: '1.0.0',
        endpoints: {
            upload: {
                method: 'POST',
                url: '/api/upload-pdf',
                fieldName: 'bookbuddy',
                description: 'Upload a PDF file'
            },
            health: {
                method: 'GET',
                url: '/api/health',
                description: 'Server health check'
            },
            test: {
                method: 'GET',
                url: '/api/test',
                description: 'Test endpoint'
            },
            files: {
                method: 'GET',
                url: '/api/files',
                description: 'List uploaded files'
            },
            download: {
                method: 'GET',
                url: '/api/download/:filename',
                description: 'Download a file'
            },
            publicFiles: {
                method: 'GET',
                url: '/public/{filename}',
                description: 'Access uploaded files directly'
            }
        },
        instructions: 'Use POST /api/upload-pdf with FormData containing a PDF file in field "bookbuddy"'
    });
});

// 404 Handler
app.use((req, res) => {
    const baseUrl = getBaseUrl(req);
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        requestedUrl: req.url,
        baseUrl: baseUrl,
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'GET /api/test',
            'GET /api/files',
            'POST /api/upload-pdf',
            'GET /api/download/:filename',
            'GET /public/{filename}'
        ]
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`📤 Upload endpoint: http://localhost:${PORT}/api/upload-pdf`);
    console.log(`💪 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Public files: http://localhost:${PORT}/public/`);
    console.log(`📋 File list: http://localhost:${PORT}/api/files`);
});