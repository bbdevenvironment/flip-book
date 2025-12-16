import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// ********************************************
// CRITICAL: REPLACE WITH YOUR ACTUAL DEPLOYED BACKEND URL
// ********************************************
const DEPLOYED_BACKEND_URL = 'https://flip-book-backend.vercel.app'; 
const UPLOAD_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/upload-pdf`;
const LOOKUP_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/get-pdf-url`;
const FRONTEND_BASE_URL = window.location.origin;

// Get initial file from URL query parameter (No change)
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

// Single Page Component (No change)
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
    const [isSharedLoading, setIsSharedLoading] = useState(false); // NEW STATE for shared link loading
    const [dimensions, setDimensions] = useState({
        width: 600,
        height: 800
    });
    
    const fileInputRef = useRef(null);
    const isSharedView = initialLoadData !== null;

    // Calculate dimensions (No change)
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

    // File Upload Function (No change)
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
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || `Upload failed with status ${response.status}`);
                } catch {
                    throw new Error(`Upload failed. Server response: ${errorText.substring(0, 100)}`);
                }
            }

            const data = await response.json();
            
            if (!data.filename || !data.publicFileUrl) {
                throw new Error("Invalid server response: Missing file URL or filename.");
            }

            setPdfData(data.publicFileUrl); 
            setShareableFlipbookUrl(`${FRONTEND_BASE_URL}/?file=${data.filename}`); 
            
            const newUrl = `${FRONTEND_BASE_URL}/?file=${data.filename}`;
            window.history.pushState({ path: newUrl }, '', newUrl);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload PDF. Check your backend deployment.');
            setPdfData(null); 
        } finally {
            setIsUploading(false); 
        }
    };

    // Event Handlers (No change)
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        
        if (!file || file.type !== 'application/pdf') {
            setError('Please select a valid PDF file (.pdf)');
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
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        const newUrl = window.location.origin + window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);
    };

    // ********************************************
    // CORRECTED useEffect Hook for Permanent Sharing Lookup
    // ********************************************
    useEffect(() => {
        const fileData = getInitialFile();
        setInitialLoadData(fileData); 
        
        if (fileData && fileData.filename) {
            setShareableFlipbookUrl(fileData.shareableUrl);
            setError(null); 
            setPdfData(null);
            setIsSharedLoading(true); // START LOADING

            const fetchSharedPdf = async (filename) => {
                try {
                    // Call the new backend endpoint to get the permanent Blob URL
                    const response = await fetch(`${LOOKUP_API_ENDPOINT}?filename=${filename}`);
                    
                    if (response.status === 404) {
                        throw new Error("File ID not found in the database. The link may be broken or expired.");
                    }
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `File lookup failed with status ${response.status}`);
                    }

                    const data = await response.json();
                    
                    if (!data.publicFileUrl) {
                        throw new Error("Database record is incomplete. Cannot retrieve the Blob URL.");
                    }

                    // SUCCESS
                    setPdfData(data.publicFileUrl); 
                    setNumPages(null);
                    setError(null); 

                } catch (err) {
                    console.error('Shared Link Error:', err);
                    setError(`Error accessing shared link: ${err.message}.`);
                    setPdfData(null);
                } finally {
                    setIsSharedLoading(false); // STOP LOADING
                }
            };

            fetchSharedPdf(fileData.filename);
        }
    }, []); 
    // ********************************************

    // Derived States
    const isLoading = isUploading;
    const { width, height } = dimensions;

    return (
        // --- THEME CHANGE: Brown/Tan Theme
        <div className={isSharedView ? 'min-h-screen bg-amber-50' : 'min-h-screen bg-stone-800'}>
            
            {/* Top Header */}
            {!isSharedView && (
                <div className="border-b border-gray-600 py-4 px-6 bg-stone-700">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-amber-50">BOOKBUDDY</h1>
                                <p className="text-stone-400 text-sm">PDF Flipbook Viewer</p>
                            </div>
                            <div>
                                {shareableFlipbookUrl && (
                                    <button 
                                        onClick={removePDF}
                                        className="px-4 py-2 bg-stone-600 text-amber-50 border border-stone-500 rounded text-sm hover:bg-stone-500"
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
                <div className="border-b border-gray-300 py-4 px-6 bg-amber-50">
                    <div className="max-w-6xl mx-auto">
                        <h1 className="text-2xl font-bold text-stone-800 text-center">BOOKBUDDY</h1>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`max-w-6xl mx-auto py-6 px-4 ${isSharedView ? '' : 'min-h-[calc(100vh-140px)]'}`}>
                
                {/* Upload Section */}
                {!isSharedView && !pdfData && (
                    <div className="mb-8">
                        <div className="border border-stone-500 p-8 rounded-lg bg-stone-700">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-amber-50 mb-2">Upload PDF Document</h2>
                                <p className="text-stone-400">Create a portrait-style flipbook from your PDF</p>
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
                                    isLoading ? 'bg-stone-500 text-stone-300 border-stone-500 cursor-not-allowed' : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                                }`}
                            >
                                {isLoading ? 'Uploading...' : 'Select PDF File'}
                            </button>
                            
                            {error && !isSharedView && (
                                <div className="mt-4 p-3 border border-red-400 bg-red-100 rounded">
                                    <p className='text-red-700 text-center'>{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Upload Status Section */}
                {!isSharedView && pdfData && (
                    <div className="mb-6">
                        <div className="border border-stone-500 p-5 rounded-lg bg-stone-700">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <p className="text-amber-50 font-semibold">Current Document</p>
                                    <p className="text-stone-400 text-sm">Portrait Flipbook View</p>
                                </div>
                                <button 
                                    onClick={handleUploadClick}
                                    className="px-4 py-2 border border-amber-600 text-amber-600 rounded text-sm hover:bg-amber-600 hover:text-white bg-stone-800"
                                >
                                    Upload New PDF
                                </button>
                            </div>
                            
                            {shareableFlipbookUrl && (
                                <div className="mt-3 pt-3 border-t border-stone-600">
                                    <p className="text-amber-50 mb-2">Share Link:</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={shareableFlipbookUrl}
                                            readOnly
                                            className="flex-1 p-2 border border-stone-500 rounded text-stone-900 text-sm bg-stone-200"
                                        />
                                        <button
                                            onClick={() => navigator.clipboard.writeText(shareableFlipbookUrl)}
                                            className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    {numPages && (
                                        <p className="text-stone-400 text-sm mt-2">Total pages: {numPages}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading State for Initial Upload */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600 mb-4"></div>
                        <p className="text-amber-50 text-lg">Uploading PDF...</p>
                        <p className="text-stone-400 mt-1">Please wait</p>
                    </div>
                )}
                
                {/* Loading State for Shared Link Lookup */}
                {isSharedView && isSharedLoading && !error && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600 mb-4"></div>
                        <p className="text-amber-50 text-lg">Fetching document link from database...</p>
                        <p className="text-stone-400 mt-1">Please wait</p>
                    </div>
                )}


                {/* PDF Content Area */}
                {pdfData && !isLoading && !isSharedLoading && (
                    <div className="flex flex-col items-center">
                        {/* PDF Document */}
                        <Document
                            file={pdfData}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-600"></div>
                                    <p className="text-amber-50 mt-2">Rendering document...</p>
                                </div>
                            }
                        >
                            {/* Single Page Portrait Flipbook */}
                            {numPages > 0 && (
                                <div className="flex flex-col items-center">
                                    <HTMLFlipBook 
                                        width={width} 
                                        height={height}
                                        size="fixed"
                                        minWidth={width}
                                        maxWidth={width}
                                        minHeight={height}
                                        maxHeight={height}
                                        className="mx-auto border border-stone-500"
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
                                    
                                    <div className="mt-4 text-center text-stone-300">
                                        <p>Page {numPages ? `1 of ${numPages}` : 'Loading...'}</p>
                                    </div>
                                    
                                    {/* Usage Instructions - Placed below flipbook */}
                                    <div className="mt-6 p-4 border border-stone-500 rounded bg-stone-700 max-w-lg text-center">
                                        <h3 className="text-amber-50 font-semibold mb-2">BookBuddy Instructions</h3>
                                        <p className="text-stone-400 text-sm">
                                            Click or swipe (left/right) on the edges of the page to turn. On touch devices, use a horizontal swipe gesture.
                                        </p>
                                    </div>

                                </div>
                            )}
                        </Document>
                    </div>
                )}
                
                {/* Error Display (General and Shared View) */}
                {error && (
                    <div className="flex justify-center py-10">
                        <div className="border border-red-400 bg-red-100 p-6 max-w-lg rounded-lg shadow-md">
                            <p className="text-red-700 font-semibold mb-2">Error / Missing File</p>
                            <p className="text-red-600">{error}</p>
                            {isSharedView && (
                                <p className="text-red-600 mt-3 text-sm">Status: Failed to retrieve permanent link via API.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Initial State - No PDF Uploaded */}
                {initialLoadData === null && !pdfData && !isLoading && !error && (
                    <div className="text-center py-20">
                        {/* Empty state content */}
                    </div>
                )}
            </div>

            {/* Footer: Copyrights@bookbuddy.in */}
            <div className="border-t border-stone-600 py-4 px-6 bg-stone-700">
                <div className="max-w-6xl mx-auto text-center">
                   <a href='https://www.book-buddy.in/' target='blank'> <p className="text-stone-400 text-sm">Copyrights@book-buddy.in</p></a>
                </div>
            </div>
        </div>
    );
}

export default Flipbook;