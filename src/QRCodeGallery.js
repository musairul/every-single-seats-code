import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import "./QRCodeGallery.css";

const TOTAL_CODES = 1000000; // 000000 to 999999
const DEFAULT_BATCH_SIZE = 24; // Default batch size
const SEARCH_DELAY = 500; // Debounce delay
const RESIZE_DELAY = 100; // Debounce delay for resize events

const QRCodeGallery = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [backspaceMode, setBackspaceMode] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE); // Dynamic batch size
  const qrCodeGridRef = useRef(null); // Ref to the QR code grid container

  // Calculate the initial batch size based on viewport height and QR code height
  const calculateInitialBatchSize = () => {
    const qrCodeHeight = 211; // Height of each QR code (including margin/padding)
    const viewportHeight = window.innerHeight;
    const qrCodesPerViewport = Math.ceil(viewportHeight / qrCodeHeight) * 4; // 4 rows per row

    // Set the batch size to at least the number of QR codes needed to fill the viewport
    return Math.max(DEFAULT_BATCH_SIZE, qrCodesPerViewport);
  };

  // Initialize visibleRange with the calculated batch size
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: calculateInitialBatchSize(), // Set initial batch size based on viewport
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DELAY);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Generate QR codes for the current visible range
  const generateQRCodesForRange = useCallback((start, end) => {
    return Array.from(
      { length: Math.min(end - start, TOTAL_CODES - start) },
      (_, i) => {
        const number = start + i;
        const paddedNumber = number.toString().padStart(6, "0");
        return (
          <div key={paddedNumber} className="qr-code-item">
            <span className="qr-code-number">{paddedNumber}</span>
            <QRCodeSVG
              value={"https://seatssoftware.com/qr/" + paddedNumber}
              size={160}
            />
          </div>
        );
      }
    );
  }, []);

  // Compute QR codes to display
  const displayQRCodes = useMemo(() => {
    return generateQRCodesForRange(visibleRange.start, visibleRange.end);
  }, [visibleRange, generateQRCodesForRange]);

  // Handle infinite scroll
  const handleScroll = useCallback(() => {
    // Show/hide the "Back to Top" button based on scroll position
    if (window.scrollY > 200) {
      setShowBackToTop(true);
    } else {
      setShowBackToTop(false);
    }

    // Load more QR codes when near the bottom
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 200
    ) {
      setVisibleRange((prev) => ({
        start: prev.start,
        end: Math.min(prev.end + batchSize, TOTAL_CODES),
      }));
    }
  }, [batchSize]);

  // Calculate the minimum batch size based on viewport height and QR code height
  const calculateBatchSize = useCallback(() => {
    const qrCodeHeight = 211; // Height of each QR code (including margin/padding)
    const viewportHeight = window.innerHeight;
    const qrCodesPerViewport = Math.ceil(viewportHeight / qrCodeHeight) * 4; // 4 rows per row

    // Set the batch size to at least the number of QR codes needed to fill the viewport
    const newBatchSize = Math.max(DEFAULT_BATCH_SIZE, qrCodesPerViewport);
    setBatchSize(newBatchSize);

    // Update the visible range to reflect the new batch size
    setVisibleRange((prev) => ({
      start: prev.start,
      end: prev.start + newBatchSize,
    }));
  }, []);

  // Handle viewport resize (including zoom)
  const handleResize = useCallback(() => {
    calculateBatchSize();
  }, [calculateBatchSize]);

  // Debounced resize handler
  useEffect(() => {
    const debouncedResizeHandler = () => {
      setTimeout(handleResize, RESIZE_DELAY);
    };

    window.addEventListener("resize", debouncedResizeHandler);
    return () => window.removeEventListener("resize", debouncedResizeHandler);
  }, [handleResize]);

  // Calculate initial batch size on mount
  useEffect(() => {
    calculateBatchSize();
  }, [calculateBatchSize]);

  // Update visible range when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== lastSearch) {
      const isBackspacing = debouncedSearchTerm.length < lastSearch.length;
      const start = debouncedSearchTerm
        ? parseInt(debouncedSearchTerm.padEnd(6, "0"), 10)
        : 0;
      const end = start + batchSize;

      setVisibleRange({ start, end });
      setBackspaceMode(isBackspacing);
      setLastSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, lastSearch, batchSize]);

  // Attach scroll listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth", // Smooth scrolling
    });
  };

  return (
    <div className="qr-code-container">
      <h1 className="page-title">EVERY SINGLE SEATS CODE</h1>
      <input
        type="text"
        placeholder="Search SEAtS Codes (e.g., 151445)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      <div className="qr-code-grid" ref={qrCodeGridRef}>
        {displayQRCodes}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button className="back-to-top-button" onClick={scrollToTop}>
          ↑ Back to Top
        </button>
      )}
    </div>
  );
};

export default QRCodeGallery;
