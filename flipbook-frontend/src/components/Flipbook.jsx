import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DEPLOYED_BACKEND_URL = 'https://flip-book-backend.vercel.app'; 
const UPLOAD_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/upload-pdf`;
const LOOKUP_API_ENDPOINT = `${DEPLOYED_BACKEND_URL}/api/get-pdf-url`;

const FlipPage = React.forwardRef((props, ref) => {
    const { pageNumber, width, height } = props; 
    return (
        <div className="demoPage" ref={ref} style={{ height, width, backgroundColor: 'white', display: 'flex', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
            <Page
                pageNumber={pageNumber}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<div className="flex items-center justify-center bg-gray-100" style={{width, height}}>Loading Page...</div>}
            />
        </div>
    );
});

FlipPage.displayName = 'FlipPage';

function Flipbook() {
    const [numPages, setNumPages] = useState(null);
    const [pdfData, setPdfData] = useState(null); 
    const [isUploading, setIsUploading] = useState(false); 
    const [currentPage, setCurrentPage] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    const fileInputRef = useRef(null);
    const flipBookRef = useRef(null);
    const containerRef = useRef(null);

    // Optimized Fullscreen Dimensions for iFrame
    const updateDimensions = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 0.707; // A4 Ratio

        let height = vh * 0.98; // Maximize vertical space
        let width = height * aspectRatio;

        if (width > vw * 0.98) {
            width = vw * 0.98;
            height = width / aspectRatio;
        }

        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    }, []);

    useEffect(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [updateDimensions]);

    // Fast Shared File Check
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        if (file) {
            fetch(`${LOOKUP_API_ENDPOINT}?filename=${file}`)
                .then(res => res.json())
                .then(data => {
                    if (data.publicFileUrl) setPdfData(data.publicFileUrl);
                });
        }
    }, []);

    // Programmatic Navigation
    const goNext = () => flipBookRef.current?.pageFlip().flipNext();
    const goPrev = () => flipBookRef.current?.pageFlip().flipPrev();

    const handleFullscreen = () => {
        if (containerRef.current.requestFullscreen) containerRef.current.requestFullscreen();
    };

    const uploadPdf = async (file) => {
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('bookbuddy', file);
        try {
            const res = await fetch(UPLOAD_API_ENDPOINT, { method: 'POST', body: formData });
            const data = await res.json();
            setPdfData(data.publicFileUrl);
            window.history.pushState({}, '', `?file=${data.filename}`);
        } catch (e) { alert("Upload error"); }
        finally { setIsUploading(false); }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden w-screen h-screen">
            
            {/* 1. UPLOAD SCREEN (Initial State) */}
            {!pdfData && !isUploading && (
                <div className="bg-white p-8 rounded-xl text-center shadow-2xl border border-gray-200">
                    <h2 className="text-xl font-bold mb-4">BookBuddy iFrame Viewer</h2>
                    <button 
                        onClick={() => fileInputRef.current.click()}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all"
                    >
                        Click to Upload PDF
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => uploadPdf(e.target.files[0])} accept=".pdf" className="hidden" />
                </div>
            )}

            {/* 2. LOADING SCREEN (Faster transition) */}
            {isUploading && (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white text-sm">Uploading and Processing...</p>
                </div>
            )}

            {/* 3. FULL SCREEN FLIPBOOK VIEW */}
            {pdfData && (
                <div className="relative w-full h-full flex items-center justify-center animate-in fade-in duration-500">
                    
                    {/* NAV ARROWS: High contrast & Large clickable area */}
                    <button 
                        onClick={goPrev}
                        className="absolute left-4 z-[100] p-4 bg-white/20 hover:bg-white text-gray-800 rounded-full backdrop-blur-sm transition-all shadow-xl"
                        style={{ display: currentPage === 1 ? 'none' : 'block' }}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    <div className="flex items-center justify-center shadow-2xl">
                        <Document 
                            file={pdfData} 
                            onLoadSuccess={({numPages}) => setNumPages(numPages)}
                            loading={<div className="text-white">Rendering Document...</div>}
                        >
                            {/* The Flipbook remains hidden until dimensions are set */}
                            {dimensions.width > 0 && (
                                <HTMLFlipBook 
                                    ref={flipBookRef}
                                    width={dimensions.width} 
                                    height={dimensions.height}
                                    size="fixed"
                                    showCover={false}
                                    flippingTime={600}
                                    usePortrait={true}
                                    startPage={0}
                                    onFlip={(e) => setCurrentPage(e.data + 1)}
                                    className="mx-auto"
                                >
                                    {Array.from({ length: numPages }, (_, i) => (
                                        <FlipPage key={i} pageNumber={i + 1} width={dimensions.width} height={dimensions.height} />
                                    ))}
                                </HTMLFlipBook>
                            )}
                        </Document>
                    </div>

                    <button 
                        onClick={goNext}
                        className="absolute right-4 z-[100] p-4 bg-white/20 hover:bg-white text-gray-800 rounded-full backdrop-blur-sm transition-all shadow-xl"
                        style={{ display: currentPage === numPages ? 'none' : 'block' }}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    {/* TOP ACTION BAR */}
                    <div className="absolute top-4 right-4 flex gap-3">
                        <button onClick={handleFullscreen} className="p-2 bg-white/10 hover:bg-white/90 text-white hover:text-black rounded transition-all">
                             ⛶ Fullscreen
                        </button>
                        <button onClick={() => setPdfData(null)} className="p-2 bg-red-500/20 hover:bg-red-500 text-white rounded transition-all">
                            ✕ Reset
                        </button>
                    </div>

                    {/* MINIMALIST INDICATOR */}
                    <div className="absolute bottom-4 bg-black/40 text-white/80 px-4 py-1 rounded-full text-xs">
                        {currentPage} / {numPages}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Flipbook;