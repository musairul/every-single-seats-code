import logo from "./logo.svg";
import "./App.css";

import React from "react";
import BruteForceQRGenerator from "./BruteForceQRGenerator";
import QRCodeGallery from "./QRCodeGallery";

function App() {
  return (
    <div className="App">
      {/* <BruteForceQRGenerator /> */}
      <QRCodeGallery />
    </div>
  );
}

export default App;
