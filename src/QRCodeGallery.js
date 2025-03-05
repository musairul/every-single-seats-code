import React, { useState, useMemo, useCallback, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./QRCodeGallery.css";

const TOTAL_CODES = 1000000; // 000000 to 999999
const BATCH_SIZE = 24;
const SMALL_BATCH_SIZE = 12; // Faster loading on backspace
const SEARCH_DELAY = 500; // Debounce delay

const QRCodeGallery = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: BATCH_SIZE,
  });
  const [lastSearch, setLastSearch] = useState("");
  const [backspaceMode, setBackspaceMode] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false); // Track whether to show the button

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
        end: Math.min(
          prev.end + (backspaceMode ? SMALL_BATCH_SIZE : BATCH_SIZE),
          TOTAL_CODES
        ),
      }));
    }
  }, [backspaceMode]);

  // Update visible range when search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== lastSearch) {
      const isBackspacing = debouncedSearchTerm.length < lastSearch.length;
      const start = debouncedSearchTerm
        ? parseInt(debouncedSearchTerm.padEnd(6, "0"), 10)
        : 0;
      const end = start + (isBackspacing ? SMALL_BATCH_SIZE : BATCH_SIZE);

      setVisibleRange({ start, end });
      setBackspaceMode(isBackspacing);
      setLastSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, lastSearch]);

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
      <div className="qr-code-grid">{displayQRCodes}</div>

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
