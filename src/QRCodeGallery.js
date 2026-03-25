import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import "./QRCodeGallery.css";
import { extractSeatsCode } from "./seatsQr";

const TOTAL_CODES = 1000000;
const DEFAULT_BATCH_SIZE = 32;
const SEARCH_DELAY = 500;
const RESIZE_DELAY = 100;
const QR_VIDEO_SIZE = 640;

const QRCodeGallery = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState({
    type: "idle",
    text: "",
  });
  const [lookupMessage, setLookupMessage] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const closeTimerRef = useRef(null);

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

  const clearLookupMessage = useCallback(() => {
    setLookupMessage(null);
  }, []);

  const stopScanner = useCallback(() => {
    if (scanFrameRef.current) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
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

      showLookupFeedback(
        copied ? "success" : "info",
        copied
          ? `Found SEAtS code ${code} and copied it to your clipboard.`
          : `Found SEAtS code ${code}. Clipboard access was unavailable.`
      );

      setScanStatus({
        type: "success",
        text: `Found SEAtS code ${code}.`,
      });

      closeTimerRef.current = window.setTimeout(() => {
        closeScanModal();
      }, 350);
    },
    [closeScanModal, copyCodeToClipboard, showLookupFeedback]
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

  const decodeImageToQrValue = useCallback((imageSource) => {
    const canvas = document.createElement("canvas");
    const width = imageSource.videoWidth || imageSource.naturalWidth || imageSource.width;
    const height =
      imageSource.videoHeight || imageSource.naturalHeight || imageSource.height;

    if (!width || !height) {
      return null;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return null;
    }

    context.drawImage(imageSource, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    return qrResult?.data ?? null;
  }, []);

  const scanCameraFrame = useCallback(async () => {
    if (!isScanModalOpen || !videoRef.current) {
      return;
    }

    const video = videoRef.current;

    if (video.readyState >= 2) {
      const rawValue = decodeImageToQrValue(video);

      if (rawValue) {
        const matched = await handleDecodedValue(rawValue, "camera");

        if (matched) {
          return;
        }
      }
    }

    scanFrameRef.current = window.requestAnimationFrame(scanCameraFrame);
  }, [decodeImageToQrValue, handleDecodedValue, isScanModalOpen]);

  const startScanner = useCallback(async () => {
    stopScanner();

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStatus({
        type: "error",
        text: "Camera access is not available on this device. You can upload a photo instead.",
      });
      return;
    }

    try {
      setScanStatus({
        type: "loading",
        text: "Starting camera...",
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: QR_VIDEO_SIZE },
          height: { ideal: QR_VIDEO_SIZE },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanStatus({
        type: "scanning",
        text: "Point your camera at a SEAtS QR code.",
      });

      scanFrameRef.current = window.requestAnimationFrame(scanCameraFrame);
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
  }, [scanCameraFrame, stopScanner]);

  const openScanner = () => {
    clearLookupMessage();
    setIsScanModalOpen(true);
    setScanStatus({
      type: "loading",
      text: "Preparing scanner...",
    });
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    clearLookupMessage();
    setScanStatus({
      type: "loading",
      text: "Reading uploaded photo...",
    });

    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
      });

      const rawValue = decodeImageToQrValue(image);
      URL.revokeObjectURL(imageUrl);

      if (!rawValue) {
        const text =
          "No QR code could be read from that photo. Try a sharper or brighter image.";
        setScanStatus({ type: "error", text });
        showLookupFeedback("error", text);
        return;
      }

      await handleDecodedValue(rawValue, "upload");
    } catch (error) {
      const text =
        "That photo could not be processed. Try another image or use the live scanner.";
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
    if (!isScanModalOpen) {
      return undefined;
    }

    startScanner();
    return () => stopScanner();
  }, [isScanModalOpen, startScanner, stopScanner]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

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
              value={`https://seatssoftware.com/qr/${paddedNumber}`}
              size={160}
            />
          </div>
        );
      }
    );
  }, []);

  const displayQRCodes = useMemo(() => {
    return generateQRCodesForRange(visibleRange.start, visibleRange.end);
  }, [generateQRCodesForRange, visibleRange.end, visibleRange.start]);

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

  return (
    <div className="qr-code-container">
      <h1 className="page-title">EVERY SINGLE SEATS CODE</h1>

      <div className="lookup-row">
        <input
          type="text"
          placeholder="Search SEAtS Codes (e.g., 151445)"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            clearLookupMessage();
          }}
          className="search-input"
        />
        <button
          type="button"
          className="camera-button"
          onClick={openScanner}
          aria-label="Open QR scanner"
        >
          Scan QR
        </button>
      </div>

      {lookupMessage && (
        <p className={`lookup-message lookup-message-${lookupMessage.type}`}>
          {lookupMessage.text}
        </p>
      )}

      <div className="qr-code-grid">{displayQRCodes}</div>

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
              {scanStatus.type === "permission-error" && (
                <button
                  type="button"
                  className="scanner-retry-button"
                  onClick={startScanner}
                >
                  Enable camera
                </button>
              )}
            </div>

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
