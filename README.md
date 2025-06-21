# Every Single SEAtS Code 🚀

A React web application that generates and displays QR codes for all possible SEAtS codes. Perfect for quickly finding and sharing specific SEAtS QR codes. 

https://every-single-seats-code.vercel.app/

## 🌟 Features

- **Complete Coverage**: Displays all 1,000,000 possible SEAtS codes (000000-999999)
- **Smart Search**: Quickly jump to specific codes using the search functionality
- **Infinite Scroll**: Loads QR codes dynamically as you scroll for optimal performance
- **Responsive Design**: Adapts to different screen sizes and viewport heights
- **Performance Optimized**:
  - Dynamic batch loading based on viewport size
  - Debounced search with a small ms delay
  - Utilizes virtualised rendering to only render whats visible
  - Smooth scrolling with "Back to Top" button

## 📊 Performance Features

- **Viewport-based Batching**: Loads only what's needed for your screen size
- **Search Optimization**: Instant jumping to specific code ranges
- **Memory Efficient**: Only renders visible QR codes to maintain performance
- **Responsive Batch Sizing**: Automatically adjusts to window resizing and zoom levels

## 📱 How It Works

1. **Dynamic Loading**: The app calculates the optimal batch size based on your viewport height to ensure smooth scrolling
2. **Search Functionality**: Type any 6-digit code to jump directly to that section
3. **QR Code Generation**: Each code generates a QR code linking to the SEAtS software URL
4. **Infinite Scroll**: More codes load automatically as you scroll down

## 🎯 Use Cases

- **Educational Institutions**: Quick access to any SEAtS code for classroom management
- **IT Support**: Helping users find specific codes without manual lookup
- **Reference Tool**: Complete database of all possible SEAtS codes in one place

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd every-single-seats-code
```

1. Install dependencies

```bash
npm install
```

1. Start the development server

```bash
npm start
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser

### 📦 Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production

## 🛠️ Technologies Used

- **React 19.0.0** - Modern React with hooks
- **qrcode.react** - QR code generation library
- **Create React App** - Project bootstrapping and build tools
- **CSS3** - Custom styling with responsive design

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---