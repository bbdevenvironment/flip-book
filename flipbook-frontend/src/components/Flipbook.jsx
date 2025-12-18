import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// API endpoints
const DEPLOYED_BACKEND_URL = 'https://flip-book-backend.vercel.app'; 
const UPLOAD_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/upload-pdf`;
const LOOKUP_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/get-pdf-url`;
const HISTORY_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/get-history`;
const FRONTEND_BASE_URL = window.location.origin;

// Maximum file size: 30MB
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB in bytes

// Get initial file from URL query parameter
const getInitialFile = () => {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file'); 
    
    if (filename) {
        return {
            filename: filename,
            publicFileUrl: null, 
            shareableUrl: `${FRONTEND_BASE_URL}/?file=${filename}`
        };
    }
    return null;
};

// Single Page Component
const FlipPage = React.forwardRef((props, ref) => {
    const { pageNumber, width, height } = props; 
    
    return (
        <div 
            className="demoPage overflow-hidden relative" 
            ref={ref} 
            style={{ 
                height: height, 
                width: width,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
            }}
        >
            <Page
                pageNumber={pageNumber}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={
                    <div className='flex items-center justify-center w-full h-full bg-gray-50'>
                        <div className="text-gray-400">Page {pageNumber}</div>
                    </div>
                }
            />
            
            {/* Subtle page indicator */}
            <div className='absolute bottom-2 right-2'>
                <div className='bg-gray-800 text-white text-xs px-2 py-0.5 rounded opacity-70'>
                    {pageNumber}
                </div>
            </div>
        </div>
    );
});

FlipPage.displayName = 'FlipPage';

// History List Component
const HistoryList = ({ history, onSelectHistory, onClose, isLoading }) => {
    const [copiedIndex, setCopiedIndex] = useState(null);
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const copyShareLink = (url, index) => {
        navigator.clipboard.writeText(url);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-900">Flipbook History</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-gray-600 mt-2">View and access your previously created flipbooks</p>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-700">Loading history...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
                            <p className="text-gray-600">Upload a PDF to create your first flipbook!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {history.map((item, index) => (
                                <div 
                                    key={index} 
                                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => onSelectHistory(item)}
                                >
                                    <div className="flex items-start mb-3">
                                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 truncate">{item.filename}</h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {formatDate(item.uploaded_at)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyShareLink(`${FRONTEND_BASE_URL}/?file=${item.filename}`, index);
                                            }}
                                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 flex items-center space-x-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            <span>{copiedIndex === index ? 'Copied!' : 'Copy Link'}</span>
                                        </button>
                                        
                                        <span className="text-xs text-gray-500">
                                            {item.pages} pages
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">
                            Showing {history.length} flipbooks
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main Flipbook Component
function Flipbook() {
    const [numPages, setNumPages] = useState(null);
    const [pdfData, setPdfData] = useState(null); 
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [shareableFlipbookUrl, setShareableFlipbookUrl] = useState(null);
    const [initialLoadData, setInitialLoadData] = useState(null); 
    const [isSharedLoading, setIsSharedLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showShareOptions, setShowShareOptions] = useState(false);
    const [fileName, setFileName] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    const fileInputRef = useRef(null);
    const flipBookRef = useRef(null);
    const containerRef = useRef(null);
    const isSharedView = initialLoadData !== null;

    // Check for mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => {
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    // Calculate dimensions for flipbook with mobile optimization
    const calculateDimensions = useCallback(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (isFullscreen) {
            // Fullscreen mode - calculate based on available space
            const availableWidth = viewportWidth * 0.95; // 95% of screen width
            const availableHeight = viewportHeight * 0.9; // 90% of screen height
            
            // Use A4 aspect ratio (1:√2 ≈ 1:1.414)
            const aspectRatio = 1 / Math.SQRT2; // Portrait orientation
            
            // Calculate width based on height constraint
            let width = availableHeight * aspectRatio;
            let height = availableHeight;
            
            // If width exceeds available width, recalculate based on width constraint
            if (width > availableWidth) {
                width = availableWidth;
                height = width / aspectRatio;
            }
            
            // Ensure dimensions are integers
            return {
                width: Math.floor(width),
                height: Math.floor(height)
            };
        }
        
        if (isMobile) {
            // Mobile mode - adjust for smaller screens
            const safeWidth = viewportWidth * 0.92; // 92% of viewport width
            const safeHeight = viewportHeight * 0.6; // 60% of viewport height
            
            const portraitRatio = 0.707;
            let width = Math.min(safeWidth, 500);
            let height = width / portraitRatio;
            
            if (height > safeHeight) {
                height = safeHeight;
                width = height * portraitRatio;
            }
            
            // Minimum dimensions for mobile
            if (width < 280) width = 280;
            if (height < 396) height = 396;
            
            return {
                width: Math.floor(width),
                height: Math.floor(height)
            };
        }
        
        // Desktop mode
        const viewportWidthDesktop = viewportWidth * 0.85;
        const viewportHeightDesktop = viewportHeight * 0.7;
        
        const portraitRatio = 0.707;
        let width = Math.min(viewportWidthDesktop, 800);
        let height = width / portraitRatio;
        
        if (height > viewportHeightDesktop) {
            height = viewportHeightDesktop;
            width = height * portraitRatio;
        }
        
        // Minimum dimensions
        if (width < 400) width = 400;
        if (height < 560) height = 560;
        
        return {
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }, [isFullscreen, isMobile]);

    const [dimensions, setDimensions] = useState(calculateDimensions());

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions(calculateDimensions());
        };
        
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        
        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, [calculateDimensions]);

    // Load history
    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const response = await fetch(HISTORY_API_ENDPOINT);
            if (response.ok) {
                const data = await response.json();
                setHistory(data.history || []);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Handle history item selection
    const handleHistorySelect = async (historyItem) => {
        setError(null);
        setIsSharedLoading(true);
        setShowHistory(false);
        
        try {
            const response = await fetch(`${LOOKUP_API_ENDPOINT}?filename=${historyItem.filename}`);
            
            if (!response.ok) {
                throw new Error("Failed to load flipbook from history");
            }

            const data = await response.json();
            
            if (!data.publicFileUrl) {
                throw new Error("Invalid flipbook data");
            }

            setPdfData(data.publicFileUrl); 
            setShareableFlipbookUrl(`${FRONTEND_BASE_URL}/?file=${historyItem.filename}`);
            setFileName(historyItem.filename);
            
            // Update URL
            const newUrl = `${FRONTEND_BASE_URL}/?file=${historyItem.filename}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
            
        } catch (err) {
            console.error('History load error:', err);
            setError(`Error loading flipbook: ${err.message}`);
            setPdfData(null);
        } finally {
            setIsSharedLoading(false);
        }
    };

    // Enhanced File Upload Function with progress tracking
    const uploadPdfToServer = async (file) => {
        setError(null);
        setNumPages(null); 
        setPdfData(null); 
        setShareableFlipbookUrl(null);
        setCurrentPage(1);
        setUploadProgress(0);
        setIsUploading(true);
        setFileName(file.name);
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            setError(`File size (${(file.size / (1024*1024)).toFixed(1)}MB) exceeds maximum limit of 30MB`);
            setIsUploading(false);
            return;
        }

        const formData = new FormData();
        formData.append('bookbuddy', file);

        try {
            // Create XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    setUploadProgress(Math.round(percentComplete));
                }
            });

            const response = await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Invalid server response'));
                        }
                    } else {
                        let errorMessage = `Upload failed with status ${xhr.status}`;
                        try {
                            const errorData = JSON.parse(xhr.responseText);
                            if (errorData.message) {
                                errorMessage = errorData.message;
                            }
                        } catch (e) {
                            // Use default error message
                        }
                        reject(new Error(errorMessage));
                    }
                };
                
                xhr.onerror = () => reject(new Error('Network error - check your connection'));
                xhr.ontimeout = () => reject(new Error('Request timeout - server may be busy'));
                
                xhr.open('POST', UPLOAD_API_ENDPOINT);
                xhr.timeout = 300000; // 5 minutes timeout for large files
                xhr.send(formData);
            });

            if (!response.filename || !response.publicFileUrl) {
                throw new Error("Invalid server response: Missing file URL or filename.");
            }

            setPdfData(response.publicFileUrl); 
            setShareableFlipbookUrl(`${FRONTEND_BASE_URL}/?file=${response.filename}`); 
            setUploadProgress(100);
            
            // Add to history immediately
            setHistory(prev => [{
                filename: response.filename,
                uploaded_at: new Date().toISOString(),
                pages: 0 // Will be updated when PDF loads
            }, ...prev]);
            
            const newUrl = `${FRONTEND_BASE_URL}/?file=${response.filename}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

        } catch (err) {
            console.error('Upload error:', err);
            let errorMsg = err.message || 'Failed to upload PDF.';
            
            // Provide more specific error messages
            if (err.message.includes('timeout')) {
                errorMsg = 'Upload timeout. Try a smaller file or check your connection.';
            } else if (err.message.includes('Network error')) {
                errorMsg = 'Network error. Check your internet connection.';
            } else if (err.message.includes('413') || err.message.includes('Payload too large')) {
                errorMsg = 'File too large. The server has a 4.5MB limit. Please compress your PDF or use a smaller file.';
            }
            
            setError(errorMsg);
            setPdfData(null); 
        } finally {
            setIsUploading(false); 
        }
    };

    // Event Handlers
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        
        if (!file) {
            setError('Please select a file');
            return;
        }
        
        if (file.type !== 'application/pdf') {
            setError('Please select a valid PDF file (.pdf)');
            return;
        }
        
        uploadPdfToServer(file); 
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setError(null);
        
        // Update history with page count for current file
        if (fileName) {
            setHistory(prev => prev.map(item => 
                item.filename === fileName.split('.')[0] + '.pdf' 
                    ? { ...item, pages: numPages }
                    : item
            ));
        }
    };
    
    const onDocumentLoadError = (error) => {
        console.error('PDF load error:', error);
        setError('Failed to load PDF. Please check the file URL or try another PDF.');
        setPdfData(null);
        setNumPages(null);
        setShareableFlipbookUrl(null);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };
    
    const removePDF = () => {
        setPdfData(null);
        setNumPages(null);
        setError(null);
        setShareableFlipbookUrl(null);
        setCurrentPage(1);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        const newUrl = window.location.origin + window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);
    };

    const handlePageChange = (page) => {
        const newPage = Math.max(1, Math.min(page, numPages || 1));
        setCurrentPage(newPage);
        if (flipBookRef.current) {
            flipBookRef.current.pageFlip().turnToPage(newPage - 1);
        }
    };

    // Toggle fullscreen function
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        // Reset dimensions when toggling fullscreen
        setTimeout(() => {
            setDimensions(calculateDimensions());
        }, 100);
    };

    const copyShareLink = () => {
        if (shareableFlipbookUrl) {
            navigator.clipboard.writeText(shareableFlipbookUrl);
            setShowShareOptions(false);
            alert('Link copied to clipboard!');
        }
    };

    // Handle drag and drop
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            uploadPdfToServer(file);
        } else {
            setError('Please drop a valid PDF file');
        }
    };

    // Handle escape key to exit fullscreen
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape') {
                if (isFullscreen) {
                    toggleFullscreen();
                }
                if (showHistory) {
                    setShowHistory(false);
                }
            }
        };

        window.addEventListener('keydown', handleEscKey);
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [isFullscreen, showHistory]);

    // useEffect Hook for Permanent Sharing Lookup
    useEffect(() => {
        const fileData = getInitialFile();
        setInitialLoadData(fileData); 
        
        if (fileData && fileData.filename) {
            setShareableFlipbookUrl(fileData.shareableUrl);
            setError(null); 
            setPdfData(null);
            setIsSharedLoading(true);

            const fetchSharedPdf = async (filename) => {
                try {
                    const response = await fetch(`${LOOKUP_API_ENDPOINT}?filename=${filename}`);
                    
                    if (response.status === 404) {
                        throw new Error("File ID not found. The link may be broken or expired.");
                    }
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `File lookup failed with status ${response.status}`);
                    }

                    const data = await response.json();
                    
                    if (!data.publicFileUrl) {
                        throw new Error("Database record is incomplete. Cannot retrieve the Blob URL.");
                    }

                    setPdfData(data.publicFileUrl); 
                    setNumPages(null);
                    setError(null); 
                    setFileName(filename);

                } catch (err) {
                    console.error('Shared Link Error:', err);
                    setError(`Error accessing shared link: ${err.message}.`);
                    setPdfData(null);
                } finally {
                    setIsSharedLoading(false);
                }
            };

            fetchSharedPdf(fileData.filename);
        }
        
        // Load history on initial mount
        loadHistory();
    }, []);

    const { width, height } = dimensions;

    return (
        <div 
            className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'min-h-screen bg-gray-50'}`}
            ref={containerRef}
        >
            {/* History Modal */}
            {showHistory && (
                <HistoryList
                    history={history}
                    onSelectHistory={handleHistorySelect}
                    onClose={() => setShowHistory(false)}
                    isLoading={isLoadingHistory}
                />
            )}

            {/* Header - Only show when not in fullscreen */}
            {!isFullscreen && (
                <div className="bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            {/* Logo and History Button */}
                            <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <div className="hidden sm:block">
                                    <h1 className="text-lg font-semibold text-gray-900">BookBuddy Flip</h1>
                                    <p className="text-xs text-gray-500">Interactive PDF Viewer</p>
                                </div>
                                
                                {/* <button
                                    onClick={() => setShowHistory(true)}
                                    className="ml-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center space-x-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">History</span>
                                </button> */}
                            </div>

                            {/* Right Side Actions */}
                            <div className="flex items-center space-x-3">
                                {pdfData && (
                                    <>
                                        <div className="hidden md:flex items-center space-x-2">
                                            <span className="text-sm text-gray-600">Page</span>
                                            <div className="flex items-center bg-gray-100 rounded">
                                                <button 
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    disabled={currentPage <= 1}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-l disabled:opacity-40"
                                                >
                                                    ←
                                                </button>
                                                <span className="px-3 py-1 text-sm font-medium">
                                                    {currentPage} of {numPages || 1}
                                                </span>
                                                <button 
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    disabled={currentPage >= (numPages || 1)}
                                                    className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-r disabled:opacity-40"
                                                >
                                                    →
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={toggleFullscreen}
                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                                            title="Fullscreen"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                                            </svg>
                                        </button>

                                        <div className="relative">
                                            <button
                                                onClick={() => setShowShareOptions(!showShareOptions)}
                                                className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center space-x-1"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684" />
                                                </svg>
                                                <span className="hidden sm:inline">Share</span>
                                            </button>

                                            {showShareOptions && (
                                                <div className="absolute right-0 mt-2 w-64 md:w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                                    <div className="p-4">
                                                        <p className="text-sm font-medium text-gray-900 mb-2">Share this flipbook</p>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <div className="flex flex-col sm:flex-row gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={shareableFlipbookUrl || ''}
                                                                        readOnly
                                                                        className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded bg-gray-50"
                                                                    />
                                                                    <button
                                                                        onClick={copyShareLink}
                                                                        className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 whitespace-nowrap"
                                                                    >
                                                                        Copy Link
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="pt-2 border-t border-gray-200">
                                                                <p className="text-xs text-gray-500">Made with BookBuddy</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                
                                {!pdfData && !isSharedView && (
                                    <button
                                        onClick={handleUploadClick}
                                        className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                                    >
                                        <span className="hidden sm:inline">Upload PDF</span>
                                        <span className="sm:hidden">Upload</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Controls */}
            {isFullscreen && (
                <div className="absolute top-0 left-0 right-0 bg-black/80 text-white p-3 sm:p-4 z-10">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <button
                                onClick={toggleFullscreen}
                                className="p-1 sm:p-2 hover:bg-white/20 rounded"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <span className="text-xs sm:text-sm">Fullscreen • Press ESC to exit</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <div className="flex items-center space-x-2">
                                <span className="text-xs sm:text-sm hidden sm:inline">Page</span>
                                <span className="text-xs sm:text-sm">{currentPage} / {numPages || 1}</span>
                                <button 
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage <= 1}
                                    className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-40"
                                >
                                    ←
                                </button>
                                <button 
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= (numPages || 1)}
                                    className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-40"
                                >
                                    →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`${isFullscreen ? 'h-full w-full flex items-center justify-center p-2' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8'}`}>
                {/* Upload Section */}
                {!isSharedView && !pdfData && !isUploading && (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
                        <div className="text-center mb-8 sm:mb-12">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
                                Create Interactive Flipbooks
                            </h1>
                            <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                                Upload your PDF to create a beautiful, interactive flipbook experience
                            </p>
                        </div>

                        <div className="w-full max-w-4xl">
                            {/* History Preview (if available) */}
                            {history.length > 0 && (
                                <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900">Recent Flipbooks</h3>
                                        <button
                                            onClick={() => setShowHistory(true)}
                                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                                        >
                                            <span>View All</span>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {history.slice(0, 3).map((item, index) => (
                                            <div 
                                                key={index}
                                                onClick={() => handleHistorySelect(item)}
                                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                            >
                                                <div className="flex items-center mb-2">
                                                    <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center mr-2">
                                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <h4 className="font-medium text-gray-900 truncate text-sm">{item.filename}</h4>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-1">
                                                    {new Date(item.uploaded_at).toLocaleDateString()}
                                                </p>
                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                                                    <span className="text-xs text-gray-500">
                                                        {item.pages || '?'} pages
                                                    </span>
                                                    <button className="text-xs text-blue-600 hover:text-blue-700">
                                                        Open →
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Upload Card */}
                            <div 
                                className="bg-white rounded-xl border-2 border-dashed border-gray-300 shadow-sm p-6 sm:p-8 hover:border-blue-400 transition-colors"
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Upload PDF</h2>
                                    <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">Drag & drop or click to browse</p>
                                    <p className="text-xs sm:text-sm text-gray-500">Supports files up to 30MB</p>
                                </div>
                                
                                <button
                                    onClick={handleUploadClick}
                                    className="w-full py-3 sm:py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center space-x-2 mb-4"
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <span className="text-sm sm:text-base">Choose PDF File</span>
                                </button>
                                
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf"
                                    className="hidden"
                                />
                                
                                <div className="text-center">
                                    <p className="text-sm text-gray-600 mb-2">Or view your history</p>
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className="text-blue-600 hover:text-blue-700 text-sm flex items-center justify-center space-x-1 mx-auto"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>View Flipbook History ({history.length})</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Progress Section */}
                {isUploading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
                        <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
                                    <div className="relative">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-200 rounded-full"></div>
                                        <div 
                                            className="absolute top-0 left-0 w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 rounded-full animate-spin"
                                            style={{ clipPath: `inset(0 ${100 - uploadProgress}% 0 0)` }}
                                        ></div>
                                    </div>
                                </div>
                                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Uploading PDF</h2>
                                <p className="text-gray-600 text-sm sm:text-base truncate">{fileName}</p>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-2">
                                    <span>Uploading...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                            
                            <div className="text-center text-gray-500 text-xs sm:text-sm space-y-1">
                                <p>• Please wait while we upload your file</p>
                                <p>• Do not close this window</p>
                                <p>• Uploading {(fileName && /\.pdf$/i.test(fileName)) ? 'PDF' : 'file'}...</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading States for Shared View */}
                {isSharedLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-base sm:text-lg font-medium text-gray-700">Loading flipbook...</p>
                        <p className="text-gray-500 text-sm sm:text-base">Please wait</p>
                    </div>
                )}

                {/* Flipbook Viewer */}
                {pdfData && !isUploading && !isSharedLoading && (
                    <div className={`flex flex-col items-center ${isFullscreen ? 'w-full h-full justify-center p-2' : ''}`}>
                        {/* Flipbook Header - Only show when not in fullscreen */}
                        {!isFullscreen && !isMobile && (
                            <div className="mb-6 sm:mb-8 text-center px-2">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Flipbook</h2>
                                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                                    {fileName} • {numPages || '?'} pages
                                </p>
                            </div>
                        )}

                        {/* The Flipbook */}
                        <div className={`relative ${isFullscreen ? 'w-full flex justify-center' : ''}`}>
                            <Document
                                file={pdfData}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={
                                    <div className="flex flex-col items-center justify-center py-12 sm:py-20">
                                        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-blue-600"></div>
                                        <p className="text-gray-700 mt-3 text-sm sm:text-base">Loading document...</p>
                                    </div>
                                }
                            >
                                {numPages > 0 && (
                                    <div className={`flex justify-center ${isFullscreen ? 'w-full' : ''}`}>
                                        <HTMLFlipBook 
                                            ref={flipBookRef}
                                            width={width} 
                                            height={height}
                                            size="fixed"
                                            minWidth={width}
                                            maxWidth={width}
                                            minHeight={height}
                                            maxHeight={height}
                                            className="mx-auto"
                                            style={{ 
                                                backgroundColor: '#f5f5f5',
                                                overflow: 'hidden'
                                            }}
                                            flippingTime={isMobile ? 400 : 600}
                                            usePortrait={true}
                                            maxShadowOpacity={0.2}
                                            showCover={false}
                                            mobileScrollSupport={true}
                                            swipeDistance={isMobile ? 20 : 30}
                                            showPageCorners={false}
                                            onFlip={(e) => setCurrentPage(e.data + 1)}
                                        >
                                            {Array.from({ length: numPages }, (_, i) => (
                                                <FlipPage 
                                                    key={i}
                                                    pageNumber={i + 1}
                                                    width={width}
                                                    height={height}
                                                />
                                            ))}
                                        </HTMLFlipBook>
                                    </div>
                                )}
                            </Document>
                        </div>

                        {/* Bottom Controls - Only show when not in fullscreen */}
                        {!isFullscreen && (
                            <div className="mt-6 sm:mt-8 flex flex-col items-center space-y-4 sm:space-y-6 w-full max-w-2xl px-2">
                                {/* Page Navigation */}
                                <div className="flex items-center justify-center space-x-2 sm:space-x-4 w-full">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1}
                                        className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-40 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                                    >
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        <span className="hidden sm:inline">Previous</span>
                                        <span className="sm:hidden">Prev</span>
                                    </button>
                                    
                                    <div className="flex items-center space-x-2">
                                        <span className="text-gray-600 text-xs sm:text-sm hidden sm:inline">Page:</span>
                                        <div className="flex items-center bg-gray-100 rounded">
                                            <button 
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage <= 1}
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-l disabled:opacity-40"
                                            >
                                                ←
                                            </button>
                                            <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium min-w-[50px] sm:min-w-[60px] text-center">
                                                {currentPage} / {numPages || 1}
                                            </span>
                                            <button 
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage >= (numPages || 1)}
                                                className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-r disabled:opacity-40"
                                            >
                                                →
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= (numPages || 1)}
                                        className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-40 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
                                    >
                                        <span className="hidden sm:inline">Next</span>
                                        <span className="sm:hidden">Next</span>
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-center space-x-2 sm:space-x-4 pt-4 border-t border-gray-200 w-full">
                                    <button
                                        onClick={handleUploadClick}
                                        className="px-3 py-1 sm:px-4 sm:py-2 text-blue-600 hover:text-blue-700 text-xs sm:text-sm flex items-center space-x-1"
                                    >
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="hidden sm:inline">Upload New</span>
                                        <span className="sm:hidden">New</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className="px-3 py-1 sm:px-4 sm:py-2 text-gray-600 hover:text-gray-700 text-xs sm:text-sm flex items-center space-x-1"
                                    >
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>History</span>
                                    </button>
                                    
                                    <button
                                        onClick={removePDF}
                                        className="px-3 py-1 sm:px-4 sm:py-2 text-red-600 hover:text-red-700 text-xs sm:text-sm flex items-center space-x-1"
                                    >
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Remove</span>
                                    </button>
                                    
                                    <button
                                        onClick={toggleFullscreen}
                                        className="px-3 py-1 sm:px-4 sm:py-2 text-gray-600 hover:text-gray-700 text-xs sm:text-sm flex items-center space-x-1"
                                    >
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                                        </svg>
                                        <span>Fullscreen</span>
                                    </button>
                                </div>

                                {/* Share Section */}
                                <div className="pt-3 sm:pt-4 border-t border-gray-200 w-full">
                                    <div className="text-center">
                                        <p className="text-gray-600 text-xs sm:text-sm mb-2">Share this flipbook</p>
                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:space-x-2">
                                            <input
                                                type="text"
                                                value={shareableFlipbookUrl || ''}
                                                readOnly
                                                className="px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded bg-gray-50 w-full max-w-md"
                                            />
                                            <button
                                                onClick={copyShareLink}
                                                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 whitespace-nowrap"
                                            >
                                                Copy Link
                                            </button>
                                        </div>
                                        <p className="text-gray-500 text-xs mt-2">Made with BookBuddy</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="flex justify-center py-8 sm:py-12 px-4">
                        <div className="max-w-lg w-full">
                            <div className="bg-white border border-red-200 rounded-xl p-4 sm:p-6 shadow-sm">
                                <div className="flex items-start mb-4">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                                        <svg className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Error</h3>
                                        <p className="text-xs sm:text-sm text-gray-600 mt-1">{error}</p>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3">
                                    {!isSharedView && (
                                        <button
                                            onClick={handleUploadClick}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                        >
                                            Try Again
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                                    >
                                        View History
                                    </button>
                                    <button
                                        onClick={removePDF}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                                    >
                                        Start Over
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer - Only show when not in fullscreen */}
            {!isFullscreen && !pdfData && (
                <div className="bg-white border-t border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                        <div className="text-center">
                           <a href='https://www.book-buddy.in/' target='blank'><p className="text-gray-600 text-xs sm:text-sm">
                                © {new Date().getFullYear()} Book-Buddy.in
                            </p> </a> 
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Flipbook;