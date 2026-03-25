import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./QRCodeGallery.css";
import { extractSeatsCode } from "./seatsQr";

const TOTAL_CODES = 1000000;
const DEFAULT_BATCH_SIZE = 32;
const SEARCH_DELAY = 500;
const RESIZE_DELAY = 100;
const CLIPBOARD_STATUS_TIMEOUT = 1000;
const CLIPBOARD_STATUS_TRANSITION = 220;
const ZOOM_APPLY_DELAY = 80;
const DEFAULT_ZOOM_STATE = {
  min: 1,
  max: 1,
  step: 0.1,
  value: 1,
  supported: false,
};

const QRCodeGallery = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [, setScanStatus] = useState({
    type: "idle",
    text: "",
  });
  const [lookupMessage, setLookupMessage] = useState(null);
  const [clipboardStatus, setClipboardStatus] = useState(null);
  const [isClipboardStatusVisible, setIsClipboardStatusVisible] = useState(false);
  const [zoomState, setZoomState] = useState(DEFAULT_ZOOM_STATE);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);
  const qrScannerClassRef = useRef(null);
  const streamRef = useRef(null);
  const closeTimerRef = useRef(null);
  const clipboardTimerRef = useRef(null);
  const clipboardHideTimerRef = useRef(null);
  const isHandlingScanResultRef = useRef(false);
  const zoomApplyTimerRef = useRef(null);
  const pendingZoomRef = useRef(DEFAULT_ZOOM_STATE.value);

  const calculateInitialBatchSize = () => {
    const qrCodeHeight = 211;
    const viewportHeight = window.innerHeight;
    const qrCodesPerViewport = Math.ceil(viewportHeight / qrCodeHeight) * 4;

    return Math.max(DEFAULT_BATCH_SIZE, qrCodesPerViewport);
  };

  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: calculateInitialBatchSize(),
  });
  const trimmedSearchTerm = searchTerm.trim();
  const exactSearchCode = /^\d{6}$/.test(trimmedSearchTerm)
    ? trimmedSearchTerm
    : null;

  const clearLookupMessage = useCallback(() => {
    setLookupMessage(null);
  }, []);

  const clearClipboardStatus = useCallback(() => {
    if (clipboardTimerRef.current) {
      window.clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = null;
    }

    if (clipboardHideTimerRef.current) {
      window.clearTimeout(clipboardHideTimerRef.current);
      clipboardHideTimerRef.current = null;
    }

    setIsClipboardStatusVisible(false);
    setClipboardStatus(null);
  }, []);

  const hideClipboardStatus = useCallback(() => {
    if (clipboardTimerRef.current) {
      window.clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = null;
    }

    setIsClipboardStatusVisible(false);

    if (clipboardHideTimerRef.current) {
      window.clearTimeout(clipboardHideTimerRef.current);
    }

    clipboardHideTimerRef.current = window.setTimeout(() => {
      setClipboardStatus(null);
      clipboardHideTimerRef.current = null;
    }, CLIPBOARD_STATUS_TRANSITION);
  }, []);

  const showClipboardStatus = useCallback(
    (type, text, autoHide = false) => {
      if (clipboardTimerRef.current) {
        window.clearTimeout(clipboardTimerRef.current);
        clipboardTimerRef.current = null;
      }

      if (clipboardHideTimerRef.current) {
        window.clearTimeout(clipboardHideTimerRef.current);
        clipboardHideTimerRef.current = null;
      }

      setClipboardStatus({ type, text });
      setIsClipboardStatusVisible(false);

      window.requestAnimationFrame(() => {
        setIsClipboardStatusVisible(true);
      });

      if (autoHide) {
        clipboardTimerRef.current = window.setTimeout(() => {
          hideClipboardStatus();
        }, CLIPBOARD_STATUS_TIMEOUT);
      }
    },
    [hideClipboardStatus]
  );

  const stopScanner = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (zoomApplyTimerRef.current) {
      window.clearTimeout(zoomApplyTimerRef.current);
      zoomApplyTimerRef.current = null;
    }

    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (error) {
        // jsdom does not implement HTMLMediaElement.pause, so cleanup can no-op in tests.
      }
      videoRef.current.srcObject = null;
    }

    isHandlingScanResultRef.current = false;
    pendingZoomRef.current = DEFAULT_ZOOM_STATE.value;
    setZoomState(DEFAULT_ZOOM_STATE);
  }, []);

  const closeScanModal = useCallback(() => {
    stopScanner();
    setIsScanModalOpen(false);
    setScanStatus({ type: "idle", text: "" });
  }, [stopScanner]);

  const showLookupFeedback = useCallback((type, text) => {
    setLookupMessage({ type, text });
  }, []);

  const copyCodeToClipboard = useCallback(async (code) => {
    if (!navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(code);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const finishSuccessfulLookup = useCallback(
    async (code) => {
      setSearchTerm(code);
      setDebouncedSearchTerm(code);
      window.scrollTo({ top: 0, behavior: "smooth" });

      const copied = await copyCodeToClipboard(code);

      showClipboardStatus(
        copied ? "success" : "error",
        copied ? "Copied code to clipboard" : "Could not copy",
        copied
      );

      setScanStatus({
        type: "success",
        text: `Found SEAtS code ${code}.`,
      });

      closeTimerRef.current = window.setTimeout(() => {
        closeScanModal();
      }, 350);
    },
    [closeScanModal, copyCodeToClipboard, showClipboardStatus]
  );

  const handleQRCodeClick = useCallback(
    async (code) => {
      setSearchTerm(code);
      setDebouncedSearchTerm(code);
      clearLookupMessage();
      clearClipboardStatus();
      window.scrollTo({ top: 0, behavior: "auto" });

      const copied = await copyCodeToClipboard(code);

      showClipboardStatus(
        copied ? "success" : "error",
        copied ? "Copied code to clipboard" : "Could not copy",
        copied
      );
    },
    [clearClipboardStatus, clearLookupMessage, copyCodeToClipboard, showClipboardStatus]
  );

  const handleDecodedValue = useCallback(
    async (rawValue, source) => {
      const code = extractSeatsCode(rawValue);

      if (!code) {
        const text =
          source === "upload"
            ? "That QR code does not match the SEAtS format."
            : "QR code detected, but it does not match the SEAtS format.";

        setScanStatus({ type: "error", text });
        showLookupFeedback("error", text);
        return false;
      }

      await finishSuccessfulLookup(code);
      return true;
    },
    [finishSuccessfulLookup, showLookupFeedback]
  );

  const loadQrScanner = useCallback(async () => {
    if (qrScannerClassRef.current) {
      return qrScannerClassRef.current;
    }

    const module = await import("qr-scanner");
    qrScannerClassRef.current = module.default;
    return qrScannerClassRef.current;
  }, []);

  const applyZoom = useCallback(async (nextZoom) => {
    const track = streamRef.current?.getVideoTracks?.()[0];

    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [{ zoom: nextZoom }],
      });

      setZoomState((current) => ({
        ...current,
        value: nextZoom,
      }));
    } catch (error) {
      // Some browsers expose zoom inconsistently. Keep scanning working even if zoom fails.
    }
  }, []);

  const initialiseZoom = useCallback(async (stream) => {
    const track = stream.getVideoTracks?.()[0];

    if (!track?.getCapabilities) {
      setZoomState(DEFAULT_ZOOM_STATE);
      return;
    }

    const capabilities = track.getCapabilities();
    const settings = track.getSettings ? track.getSettings() : {};
    const zoomCapabilities = capabilities?.zoom;

    if (!zoomCapabilities) {
      setZoomState(DEFAULT_ZOOM_STATE);
      return;
    }

    const nextZoomState = {
      min: zoomCapabilities.min ?? 1,
      max: zoomCapabilities.max ?? 1,
      step: zoomCapabilities.step ?? 0.1,
      value: settings.zoom ?? zoomCapabilities.min ?? 1,
      supported: true,
    };

    pendingZoomRef.current = nextZoomState.value;
    setZoomState(nextZoomState);

    if (typeof settings.zoom !== "number" && typeof nextZoomState.value === "number") {
      await applyZoom(nextZoomState.value);
    }
  }, [applyZoom]);

  const openScanner = useCallback(async () => {
    clearLookupMessage();
    clearClipboardStatus();
    isHandlingScanResultRef.current = false;
    setIsScanModalOpen(true);
    setScanStatus({
      type: "loading",
      text: "Preparing scanner...",
    });

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus({
        type: "error",
        text: "Camera access is not available on this device. You can upload a photo instead.",
      });
      return;
    }

    try {
      const QrScanner = await loadQrScanner();
      const scanner = new QrScanner(
        videoRef.current,
        async (result) => {
          if (isHandlingScanResultRef.current) {
            return;
          }

          isHandlingScanResultRef.current = true;

          const matched = await handleDecodedValue(result.data, "camera");

          if (!matched) {
            isHandlingScanResultRef.current = false;
          }
        },
        {
          onDecodeError: () => {},
          preferredCamera: "environment",
          maxScansPerSecond: 12,
          returnDetailedScanResult: true,
        }
      );

      scannerRef.current = scanner;
      await scanner.start();
      streamRef.current = videoRef.current?.srcObject ?? null;

      if (streamRef.current) {
        await initialiseZoom(streamRef.current);
      }

      setScanStatus({
        type: "scanning",
        text: "Point your camera at a SEAtS QR code.",
      });
    } catch (error) {
      const denied =
        error?.name === "NotAllowedError" || error?.name === "SecurityError";

      setScanStatus({
        type: denied ? "permission-error" : "error",
        text: denied
          ? "Camera access was denied. You can allow it or upload a photo instead."
          : "Unable to start the camera. Try again or upload a photo instead.",
      });
    }
  }, [
    clearClipboardStatus,
    clearLookupMessage,
    handleDecodedValue,
    initialiseZoom,
    loadQrScanner,
  ]);

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleZoomChange = useCallback(
    (event) => {
      const nextZoom = Number(event.target.value);
      pendingZoomRef.current = nextZoom;

      setZoomState((current) => ({
        ...current,
        value: nextZoom,
      }));

      if (zoomApplyTimerRef.current) {
        window.clearTimeout(zoomApplyTimerRef.current);
      }

      zoomApplyTimerRef.current = window.setTimeout(() => {
        applyZoom(pendingZoomRef.current);
        zoomApplyTimerRef.current = null;
      }, ZOOM_APPLY_DELAY);
    },
    [applyZoom]
  );

  const handleUploadChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    clearLookupMessage();
    clearClipboardStatus();
    setScanStatus({
      type: "loading",
      text: "Reading uploaded photo...",
    });

    try {
      const QrScanner = await loadQrScanner();
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      });

      await handleDecodedValue(result.data, "upload");
    } catch (error) {
      const text =
        error?.message?.toLowerCase().includes("no qr code found")
          ? "No QR code could be read from that photo. Try a sharper or brighter image."
          : "That photo could not be processed. Try another image or use the live scanner.";
      setScanStatus({ type: "error", text });
      showLookupFeedback("error", text);
    }
  };

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, SEARCH_DELAY);

    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) {
        window.clearTimeout(clipboardTimerRef.current);
      }

      if (clipboardHideTimerRef.current) {
        window.clearTimeout(clipboardHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const renderQRCodeItem = useCallback((code, isFeatured = false) => {
    return (
      <div
        key={code}
        className={isFeatured ? "qr-code-item qr-code-item-featured" : "qr-code-item"}
        onClick={() => handleQRCodeClick(code)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleQRCodeClick(code);
          }
        }}
      >
        <span className="qr-code-number">{code}</span>
        <QRCodeSVG value={`https://seatssoftware.com/qr/${code}`} size={160} />
      </div>
    );
  }, [handleQRCodeClick]);

  const generateQRCodeCodesForRange = useCallback((start, end) => {
    return Array.from(
      { length: Math.min(end - start, TOTAL_CODES - start) },
      (_, i) => (start + i).toString().padStart(6, "0")
    );
  }, []);

  const displayStart = exactSearchCode
    ? parseInt(exactSearchCode, 10)
    : visibleRange.start;
  const displayCount = Math.max(visibleRange.end - visibleRange.start, batchSize);
  const displayEnd = exactSearchCode
    ? Math.min(displayStart + displayCount, TOTAL_CODES)
    : visibleRange.end;

  const displayCodes = useMemo(() => {
    return generateQRCodeCodesForRange(displayStart, displayEnd);
  }, [displayEnd, displayStart, generateQRCodeCodesForRange]);

  const featuredCode = exactSearchCode;
  const remainingCodes = featuredCode
    ? displayCodes.filter((code) => code !== featuredCode)
    : displayCodes;

  const handleScroll = useCallback(() => {
    setShowBackToTop(window.scrollY > 200);

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

  const calculateBatchSize = useCallback(() => {
    const qrCodeHeight = 211;
    const viewportHeight = window.innerHeight;
    const qrCodesPerViewport = Math.ceil(viewportHeight / qrCodeHeight) * 4;
    const nextBatchSize = Math.max(DEFAULT_BATCH_SIZE, qrCodesPerViewport);

    setBatchSize(nextBatchSize);
    setVisibleRange((prev) => ({
      start: prev.start,
      end: prev.start + nextBatchSize,
    }));

    handleScroll();
  }, [handleScroll]);

  useEffect(() => {
    const debouncedResizeHandler = () => {
      window.setTimeout(calculateBatchSize, RESIZE_DELAY);
    };

    window.addEventListener("resize", debouncedResizeHandler);
    return () => window.removeEventListener("resize", debouncedResizeHandler);
  }, [calculateBatchSize]);

  useEffect(() => {
    calculateBatchSize();
  }, [calculateBatchSize]);

  useEffect(() => {
    if (debouncedSearchTerm !== lastSearch) {
      const start = debouncedSearchTerm
        ? parseInt(debouncedSearchTerm.padEnd(6, "0"), 10)
        : 0;

      setVisibleRange({
        start,
        end: Math.min(start + batchSize, TOTAL_CODES),
      });
      setLastSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, lastSearch, batchSize]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleTitleClick = () => {
    setSearchTerm("000000");
    setDebouncedSearchTerm("000000");
    window.setTimeout(() => {
      setSearchTerm("");
      setDebouncedSearchTerm("");
    }, 0);
    setLastSearch("");
    clearLookupMessage();
    clearClipboardStatus();
  };

  return (
    <div className="qr-code-container">
      <h1 className="page-title">
        <span className="page-title-button" onClick={handleTitleClick}>
          EVERY SINGLE SEATS CODE
        </span>
      </h1>

      <div className="lookup-row">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search SEAtS Codes (e.g., 151445)"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              clearLookupMessage();
              clearClipboardStatus();
            }}
            className="search-input"
          />
          <button
            type="button"
            className="camera-button"
            onClick={openScanner}
            aria-label="Open QR scanner"
          >
            <span aria-hidden="true">📷</span>
          </button>
        </div>
      </div>

      {lookupMessage && (
        <p className={`lookup-message lookup-message-${lookupMessage.type}`}>
          {lookupMessage.text}
        </p>
      )}

      {featuredCode && (
        <div className="featured-qr-code">
          {renderQRCodeItem(featuredCode, true)}
        </div>
      )}

      <div className="qr-code-grid">
        {remainingCodes.map((code) => renderQRCodeItem(code))}
      </div>

      {clipboardStatus && (
        <p
          className={`clipboard-status clipboard-status-${clipboardStatus.type} ${
            isClipboardStatusVisible ? "clipboard-status-visible" : ""
          }`}
          aria-live="polite"
        >
          {clipboardStatus.text}
        </p>
      )}

      {showBackToTop && (
        <button className="scroll-to-top-button" onClick={scrollToTop}>
          Back to Top
        </button>
      )}

      {isScanModalOpen && (
        <div
          className="scanner-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-modal-title"
          onClick={closeScanModal}
        >
          <div
            className="scanner-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="scanner-modal-header">
              <h2 id="scanner-modal-title">Scan a SEAtS QR code</h2>
            </div>

            <div className="scanner-preview">
              <video ref={videoRef} className="scanner-video" muted playsInline />
              <div className="scanner-retry-message">Enable camera to scan QR codes</div>
            </div>

            {zoomState.supported && (
              <div className="scanner-zoom-control">
                <input
                  type="range"
                  min={zoomState.min}
                  max={zoomState.max}
                  step={zoomState.step}
                  value={zoomState.value}
                  onChange={handleZoomChange}
                  className="scanner-zoom-slider"
                  aria-label="Camera zoom"
                />
              </div>
            )}

            <div className="scanner-upload-section">
              <button
                type="button"
                className="scanner-upload-button"
                onClick={triggerUpload}
              >
                Upload photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="scanner-file-input"
                onChange={handleUploadChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeGallery;
