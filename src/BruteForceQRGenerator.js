import React, { useState, useEffect } from "react";
import * as QRCode from "qrcode";

const BruteForceQRGenerator = () => {
  const [currentNumber, setCurrentNumber] = useState("000000");
  const [qrCodeDataUrl, setQRCodeDataUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Generate QR code for the current number
  const generateQRCode = async (number) => {
    try {
      const qrCodeUrl = await QRCode.toDataURL(
        "https://seatssoftware.com/qr/" + number,
        {
          width: 300,
          height: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        }
      );
      setQRCodeDataUrl(qrCodeUrl);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  // Generator function for six-digit numbers
  const generateNextNumber = (current) => {
    const num = parseInt(current) + 1;
    return num < 1000000 ? String(num).padStart(6, "0") : null;
  };

  // Start the brute force process
  const startBruteForce = () => {
    setIsRunning(true);
  };

  // Stop the brute force process
  const stopBruteForce = () => {
    setIsRunning(false);
  };

  // Effect to iterate through numbers and generate QR codes
  useEffect(() => {
    let intervalId;

    if (isRunning) {
      intervalId = setInterval(() => {
        const nextNumber = generateNextNumber(currentNumber);

        if (nextNumber) {
          setCurrentNumber(nextNumber);
          generateQRCode(nextNumber);
        } else {
          // Reached the end of numbers
          setIsRunning(false);
        }
      }, 1); // milliseconds between each QR code
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, currentNumber]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold mb-2">
          QR Code Brute Force Generator
        </h1>
        <p className="text-gray-600">Current Number: {currentNumber}</p>
      </div>

      {qrCodeDataUrl && (
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <img
            src={qrCodeDataUrl}
            alt={`QR Code for ${currentNumber}`}
            className="w-64 h-64 mx-auto"
          />
        </div>
      )}

      <div className="mt-4 space-x-2">
        {!isRunning ? (
          <button
            onClick={startBruteForce}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Start QR Code Generation
          </button>
        ) : (
          <button
            onClick={stopBruteForce}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Stop Generation
          </button>
        )}
      </div>
    </div>
  );
};

export default BruteForceQRGenerator;
