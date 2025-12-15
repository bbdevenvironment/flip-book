import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// Backend API endpoints
const UPLOAD_API_ENDPOINT = 'https://flip-book-backend.vercel.app/api/upload-pdf';
const FRONTEND_BASE_URL = window.location.origin;

// Get initial file from URL query parameter
const getInitialFile = () => {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file'); 
    
    if (filename) {
        return {
            filename: filename,
            publicFileUrl: `https://flip-book-backend.vercel.app/public/${filename}`,
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
            className="demoPage overflow-hidden" 
            ref={ref} 
            style={{ 
                height: height, 
                width: width,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white'
            }}
        >
            <Page
                pageNumber={pageNumber}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={
                    <div className='flex items-center justify-center w-full h-full bg-gray-100'>
                        <div className="text-gray-500">Loading page {pageNumber}...</div>
                    </div>
                }
            />
            <div className='absolute bottom-0 left-0 w-full p-2 text-center text-xs text-gray-500 border-t border-gray-200'>
                Page {pageNumber}
            </div>
        </div>
    );
});

FlipPage.displayName = 'FlipPage';

// Main Flipbook Component
function Flipbook() {
    const [numPages, setNumPages] = useState(null);
    const [pdfData, setPdfData] = useState(null); 
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false); 
    const [shareableFlipbookUrl, setShareableFlipbookUrl] = useState(null);
    const [initialLoadData, setInitialLoadData] = useState(null); 
    const [dimensions, setDimensions] = useState({
        width: 600,
        height: 800
    });
    
    const fileInputRef = useRef(null);
    const isSharedView = initialLoadData !== null;

    // Calculate portrait dimensions
    const calculateDimensions = useCallback(() => {
        const viewportWidth = window.innerWidth * 0.9;
        const viewportHeight = window.innerHeight * 0.8;
        
        const portraitRatio = 0.707;
        let pageWidth = Math.min(viewportWidth, 800);
        let pageHeight = pageWidth / portraitRatio;
        
        if (pageHeight > viewportHeight) {
            pageHeight = viewportHeight;
            pageWidth = pageHeight * portraitRatio;
        }
        
        if (pageWidth < 400) pageWidth = 400;
        if (pageHeight < 500) pageHeight = 500;
        
        return {
            width: Math.floor(pageWidth),
            height: Math.floor(pageHeight)
        };
    }, []);

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

    // File Upload Function
    const uploadPdfToServer = async (file) => {
        setError(null);
        setNumPages(null); 
        setPdfData(null); 
        setShareableFlipbookUrl(null);
        setIsUploading(true);
        
        const formData = new FormData();
        formData.append('bookbuddy', file);

        try {
            const response = await fetch(UPLOAD_API_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const data = await response.json();
            
            if (!data.filename || !data.publicFileUrl) {
                throw new Error("Invalid server response");
            }

            setPdfData(data.publicFileUrl);
            setShareableFlipbookUrl(`${FRONTEND_BASE_URL}/?file=${data.filename}`);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload PDF. Please try again.');
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
            setError('Please select a PDF file (.pdf)');
            return;
        }
        
        uploadPdfToServer(file); 
    };

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setError(null);
    };
    
    const onDocumentLoadError = (error) => {
        console.error('PDF load error:', error);
        setError('Failed to load PDF. Please check the file or try another PDF.');
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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Initial Load
    useEffect(() => {
        const fileData = getInitialFile();
        setInitialLoadData(fileData); 
        if (fileData) {
            setPdfData(fileData.publicFileUrl);
            setShareableFlipbookUrl(fileData.shareableUrl);
        }
    }, []); 

    // Derived States
    const isLoading = isUploading;
    const isReady = pdfData !== null && numPages !== null && error === null;
    const isIdle = pdfData === null && numPages === null && error === null && !isUploading && !isSharedView;

    const { width, height } = dimensions;

    return (
        <div className={isSharedView ? 'min-h-screen bg-white' : 'min-h-screen bg-black'}>
            
            {/* Top Header */}
            {!isSharedView && (
                <div className="border-b border-gray-300 py-4 px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-white">BOOKBUDDY</h1>
                                <p className="text-gray-600 text-sm">PDF Flipbook Viewer</p>
                            </div>
                            <div>
                                {shareableFlipbookUrl && (
                                    <button 
                                        onClick={removePDF}
                                        className="px-4 py-2 bg-black text-white border border-black rounded text-sm hover:bg-gray-800"
                                    >
                                        Remove PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Shared View Header */}
            {isSharedView && (
                <div className="border-b border-gray-300 py-4 px-6">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-2xl font-bold text-black text-center">BOOKBUDDY</h1>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`max-w-6xl mx-auto py-6 px-4 ${isSharedView ? '' : 'min-h-[calc(100vh-140px)]'}`}>
                
                {/* Upload Section */}
                {!isSharedView && !pdfData && (
                    <div className="mb-8">
                        <div className="border border-gray-300 p-8 rounded-lg">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-white mb-2">Upload PDF Document</h2>
                                <p className="text-gray-600">Create a portrait-style flipbook from your PDF</p>
                            </div>
                            
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".pdf"
                                className='hidden'
                            />
                            
                            <button
                                onClick={handleUploadClick}
                                disabled={isLoading} 
                                className={`w-full py-4 rounded text-lg border ${
                                    isLoading ? 'bg-gray-200 text-gray-600 border-white cursor-not-allowed' : 'bg-black text-white border-black hover:bg-gray-800'
                                }`}
                            >
                                {isLoading ? 'Uploading...' : 'Select PDF File'}
                            </button>
                            
                            {error && (
                                <div className="mt-4 p-3 border border-gray-400 rounded">
                                    <p className='text-black text-center'>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Upload Status Section */}
                {!isSharedView && pdfData && (
                    <div className="mb-6">
                        <div className="border border-gray-300 p-5 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <p className="text-black font-semibold">Current Document</p>
                                    <p className="text-gray-600 text-sm">Portrait Flipbook View</p>
                                </div>
                                <button 
                                    onClick={handleUploadClick}
                                    className="px-4 py-2 border border-black text-black rounded text-sm hover:bg-gray-100"
                                >
                                    Upload New PDF
                                </button>
                            </div>
                            
                            {shareableFlipbookUrl && (
                                <div className="mt-3 pt-3 border-t border-gray-300">
                                    <p className="text-black mb-2">Share Link:</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={shareableFlipbookUrl}
                                            readOnly
                                            className="flex-1 p-2 border border-gray-300 rounded text-black text-sm bg-white"
                                        />
                                        <button
                                            onClick={() => navigator.clipboard.writeText(shareableFlipbookUrl)}
                                            className="px-4 py-2 border border-black text-white rounded text-sm hover:bg-black-100"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    {numPages && (
                                        <p className="text-gray-600 text-sm mt-2">Total pages: {numPages}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black mb-4"></div>
                        <p className="text-black text-lg">Uploading PDF...</p>
                        <p className="text-gray-600 mt-1">Please wait</p>
                    </div>
                )}

                {/* PDF Content Area */}
                {pdfData && !isLoading && (
                    <div className="flex justify-center">
                        {/* PDF Loading */}
                        {numPages === null && !error && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mb-3"></div>
                                <p className="text-black">Loading PDF...</p>
                            </div>
                        )}
                        
                        {/* Error Display */}
                        {error && (
                            <div className="border border-gray-400 p-6 max-w-md">
                                <p className="text-black font-semibold mb-2">Error</p>
                                <p className="text-gray-600">{error}</p>
                            </div>
                        )}

                        {/* PDF Document */}
                        <Document
                            file={pdfData}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-black"></div>
                                    <p className="text-black mt-2">Loading document...</p>
                                </div>
                            }
                        >
                            {/* Single Page Portrait Flipbook */}
                            {isReady && numPages > 0 && (
                                <div>
                                    <HTMLFlipBook 
                                        width={width} 
                                        height={height}
                                        size="fixed"
                                        minWidth={width}
                                        maxWidth={width}
                                        minHeight={height}
                                        maxHeight={height}
                                        className="mx-auto border border-gray-300"
                                        style={{ backgroundColor: 'white' }}
                                        flippingTime={500}
                                        usePortrait={true}
                                        maxShadowOpacity={0.2}
                                        showCover={false}
                                        mobileScrollSupport={true}
                                        swipeDistance={30}
                                        showPageCorners={false}
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
                                    
                                    <div className="mt-4 text-center text-gray-600">
                                        <p>Page {numPages ? `1 of ${numPages}` : 'Loading...'}</p>
                                    </div>
                                </div>
                            )}
                        </Document>
                    </div>
                )}

                {/* Initial State - No PDF Uploaded */}
                {isIdle && !isSharedView && !pdfData && (
                    <div className="text-center py-20">
                        {/* Empty state - you can add content here */}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-300 py-4 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div>
                            <p className="text-gray-600 font-bold">BOOKBUDDY</p>
                        </div>
                        <div className="mt-2 md:mt-0">
                           <p className="text-gray-600 text-sm">Portrait PDF Flipbook Viewer</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Flipbook;