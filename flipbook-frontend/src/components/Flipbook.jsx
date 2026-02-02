import React, { useState, useRef, useCallback, useEffect } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DEPLOYED_BACKEND_URL = 'https://flip-book-backend.vercel.app'; 
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
                loading={<div className="flex items-center justify-center bg-gray-100" style={{width, height}}>...</div>}
            />
        </div>
    );
});

FlipPage.displayName = 'FlipPage';

function Flipbook() {
    const [numPages, setNumPages] = useState(null);
    const [pdfData, setPdfData] = useState(null); 
    const [currentPage, setCurrentPage] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    
    const flipBookRef = useRef(null);
    const containerRef = useRef(null);

    // Optimized Fullscreen Dimensions for iFrame
    const updateDimensions = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 0.707; // A4 Ratio

        let height = vh * 0.98; 
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

    // Fast Detecting Shared File or Blob detected via URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        if (file) {
            fetch(`${LOOKUP_API_ENDPOINT}?filename=${file}`)
                .then(res => res.json())
                .then(data => {
                    if (data.publicFileUrl) setPdfData(data.publicFileUrl);
                })
                .catch(err => console.error("Blob detection error:", err));
        }
    }, []);

    const handleFullscreen = () => {
        if (containerRef.current.requestFullscreen) {
            containerRef.current.requestFullscreen();
        }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center overflow-hidden w-screen h-screen">
            
            {/* 1. INITIAL STATE: Subtle Loader */}
            {!pdfData && (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-white/30 text-[10px] tracking-[0.2em]">LOADING</p>
                </div>
            )}

            {/* 2. GENERATED FLIPBOOK VIEW */}
            {pdfData && (
                <div className="relative w-full h-full flex items-center justify-center animate-in fade-in zoom-in duration-700">
                    
                    {/* THE BOOK (Navigation happens via page clicks/drags) */}
                    <div className="flex items-center justify-center shadow-[0_0_60px_rgba(0,0,0,0.8)] cursor-pointer">
                        <Document 
                            file={pdfData} 
                            onLoadSuccess={({numPages}) => setNumPages(numPages)}
                            loading={<div className="animate-pulse text-white/20">Preparing...</div>}
                        >
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
                                    showPageCorners={true} // Visual hint that pages can be flipped
                                    disableFlipByClick={false} // Ensure clicking works for navigation
                                >
                                    {Array.from({ length: numPages || 0 }, (_, i) => (
                                        <FlipPage key={i} pageNumber={i + 1} width={dimensions.width} height={dimensions.height} />
                                    ))}
                                </HTMLFlipBook>
                            )}
                        </Document>
                    </div>

                    {/* TOP ACTION BUTTONS */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <button 
                            onClick={handleFullscreen} 
                            className="px-4 py-2 bg-white/5 hover:bg-white/20 text-white/50 hover:text-white rounded-md text-[10px] transition-all backdrop-blur-sm border border-white/10"
                        >
                             FULLSCREEN
                        </button>
                    </div>

                    {/* MINIMAL PAGE COUNT */}
                    <div className="absolute bottom-6 bg-white/5 text-white/40 px-5 py-1.5 rounded-full text-[10px] tracking-widest border border-white/5 backdrop-blur-sm">
                        {currentPage} / {numPages}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Flipbook;