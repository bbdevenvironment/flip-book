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
        <div className="demoPage" ref={ref} style={{ height, width, backgroundColor: 'white', display: 'flex', overflow: 'hidden' }}>
            <Page
                pageNumber={pageNumber}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer={false}
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

    // Dynamic Full Viewport Calculation
    const updateDimensions = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 0.707; // A4 Ratio

        let height = vh * 0.95; // Use 95% of available vertical height
        let width = height * aspectRatio;

        if (width > vw * 0.95) {
            width = vw * 0.95;
            height = width / aspectRatio;
        }

        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    }, []);

    useEffect(() => {
        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [updateDimensions]);

    // Check for shared file on load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const file = params.get('file');
        if (file) {
            fetch(`${LOOKUP_API_ENDPOINT}?filename=${file}`)
                .then(res => res.json())
                .then(data => data.publicFileUrl && setPdfData(data.publicFileUrl));
        }
    }, []);

    // Fixed Navigation Functions
    const goNext = () => {
        if (flipBookRef.current) {
            flipBookRef.current.pageFlip().flipNext();
        }
    };

    const goPrev = () => {
        if (flipBookRef.current) {
            flipBookRef.current.pageFlip().flipPrev();
        }
    };

    const handleFullscreen = () => {
        if (containerRef.current.requestFullscreen) {
            containerRef.current.requestFullscreen();
        }
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
        <div ref={containerRef} className="fixed inset-0 bg-[#222] flex items-center justify-center overflow-hidden">
            
            {/* UPLOAD SCREEN */}
            {!pdfData && !isUploading && (
                <div className="bg-white p-10 rounded-2xl text-center shadow-2xl">
                    <h2 className="text-2xl font-bold mb-6">BookBuddy Flipbook</h2>
                    <button 
                        onClick={() => fileInputRef.current.click()}
                        className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition-all"
                    >
                        Upload PDF to Begin
                    </button>
                    <input type="file" ref={fileInputRef} onChange={(e) => uploadPdf(e.target.files[0])} accept=".pdf" className="hidden" />
                </div>
            )}

            {isUploading && <div className="text-white text-xl animate-pulse">Processing Flipbook...</div>}

            {/* FLIPBOOK VIEW */}
            {pdfData && (
                <div className="relative w-full h-full flex items-center justify-center">
                    
                    {/* LEFT ARROW BUTTON */}
                    <button 
                        onClick={goPrev}
                        className="absolute left-8 z-[100] p-5 bg-white/10 hover:bg-white/90 text-white hover:text-black rounded-full transition-all"
                        style={{ display: currentPage === 1 ? 'none' : 'block' }}
                    >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>

                    {/* THE BOOK */}
                    <div className="shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <Document file={pdfData} onLoadSuccess={({numPages}) => setNumPages(numPages)}>
                            <HTMLFlipBook 
                                ref={flipBookRef}
                                width={dimensions.width} 
                                height={dimensions.height}
                                size="fixed"
                                showCover={false}
                                flippingTime={700}
                                usePortrait={true}
                                startPage={0}
                                onFlip={(e) => setCurrentPage(e.data + 1)}
                            >
                                {Array.from({ length: numPages }, (_, i) => (
                                    <FlipPage key={i} pageNumber={i + 1} width={dimensions.width} height={dimensions.height} />
                                ))}
                            </HTMLFlipBook>
                        </Document>
                    </div>

                    {/* RIGHT ARROW BUTTON */}
                    <button 
                        onClick={goNext}
                        className="absolute right-8 z-[100] p-5 bg-white/10 hover:bg-white/90 text-white hover:text-black rounded-full transition-all"
                        style={{ display: currentPage === numPages ? 'none' : 'block' }}
                    >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    {/* TOP CONTROLS (Fullscreen & Close) */}
                    <div className="absolute top-6 right-8 flex gap-4">
                        <button onClick={handleFullscreen} className="bg-white/20 hover:bg-white/90 text-white hover:text-black p-3 rounded-lg backdrop-blur transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
                        </button>
                        <button onClick={() => setPdfData(null)} className="bg-red-500/20 hover:bg-red-500 text-white p-3 rounded-lg backdrop-blur transition-all">
                            ✕ Close
                        </button>
                    </div>

                    {/* PAGE INDICATOR */}
                    <div className="absolute bottom-6 bg-black/50 text-white px-6 py-2 rounded-full backdrop-blur">
                        Page {currentPage} of {numPages}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Flipbook;