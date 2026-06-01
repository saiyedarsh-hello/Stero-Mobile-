# Stero 🎵

A feature-rich, beautiful Desktop Music Player built with React, Vite, Electron, and Tailwind CSS. Stero allows you to play local audio files, manage playlists, and even download music directly from YouTube Music!

## Features

- **Modern UI**: Built with React and styled beautifully with Tailwind CSS.
- **Local Library Management**: Organizes your music, reads metadata, and manages playlists using a local SQLite database.
- **Music Downloader**: Integrated with YouTube Music to search, download, and extract high-quality audio seamlessly.
- **Cross-Platform**: Built on Electron, ensuring it can run across different operating systems.

## Tech Stack

- **Frontend**: React (v19), Vite, Tailwind CSS, Zustand (State Management)
- **Desktop/Backend**: Electron, Node.js
- **Database**: `better-sqlite3`
- **Audio/Downloads**: `youtube-dl-exec`, `ytmusic-api`, `ffmpeg-static`, `music-metadata`
- **Packaging**: `electron-builder`, `tsup`

## File Structure

```text
Stero/
├── src/                # React Frontend Code
│   ├── assets/         # Static assets (images, icons)
│   ├── components/     # Reusable React components (Player, Lists, Modals, etc.)
│   ├── store/          # Zustand global state management
│   ├── constants/      # App constants
│   ├── App.jsx         # Main React application component
│   └── main.jsx        # React entry point
├── electron/           # Electron Backend/Main Process Code
│   ├── main.cjs        # Main Electron window and app lifecycle
│   ├── preload.cjs     # Preload script (contextBridge between Node and React)
│   ├── db.cjs          # SQLite database setup and queries
│   └── downloader.cjs  # YouTube Music download logic and audio processing
├── public/             # Public static files (icons, favicon)
├── dist/               # Compiled React build output
├── dist-electron/      # Compiled Electron main process output
├── dist-desktop/       # Packaged Desktop Executable (.exe files)
├── package.json        # Project metadata, scripts, and dependencies
└── vite.config.js      # Vite configuration
```

## Getting Started

Follow these steps to set up and run the code on your local device.

### Prerequisites

You will need the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Git** (to clone the repository)

### 1. Clone the Repository

```bash
git clone https://github.com/saiyedarsh-hello/Stero.git
cd Stero
```

### 2. Install Dependencies

Install all required Node.js packages. Since this project uses native modules like `better-sqlite3`, it will compile the binaries during installation.

```bash
npm install
```

*(Note: If you run into issues installing `better-sqlite3` on Windows, ensure you have Python and Visual Studio Build Tools installed, or run `npm install --global windows-build-tools`)*.

### 3. Run in Development Mode

To start the application in development mode with Hot-Module Replacement (HMR) enabled for React:

```bash
npm run dev
```

This will concurrently start the Vite React server and launch the Electron desktop window. Any changes you make to the frontend (`src/`) will automatically reflect in the app.

### 4. Build for Production

If you want to package the app into a standalone executable:

1. **Build the source files** (both React and Electron):
   ```bash
   npm run build
   ```
2. **Package the application**:
   By default, the script is configured to build an executable for Windows:
   ```bash
   npm run dist
   ```
   *The packaged executables will be available in the `dist-desktop/` directory.*

> **Building for Other Devices (Mac/Linux)**: 
> The default `dist` script is set to `electron-builder --win`. To build for macOS or Linux, simply use `npx electron-builder`:
> - Mac: `npx electron-builder --mac`
> - Linux: `npx electron-builder --linux`

## License

This project is intended for personal use. Ensure you comply with YouTube's Terms of Service when using the downloading features.
