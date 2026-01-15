# Building Executable for Medical App

This guide explains how to build the Medical App into an executable installer that can install dependencies automatically.

## Prerequisites

Before building, ensure you have:

1. **Node.js 22+** - [Download here](https://nodejs.org/)
2. **Python 3.13+** (optional but recommended) - [Download here](https://www.python.org/downloads/)
3. **pnpm** - Install with `npm install -g pnpm`

## Building the Application

### For Windows (.exe installer)

```bash
npm run dist:win
```

This will create a Windows installer in the `dist` folder that:
- Checks for Node.js and Python during installation
- Guides users to install missing dependencies
- Creates desktop and start menu shortcuts
- Allows users to choose installation directory

### For macOS (.dmg)

```bash
npm run dist:mac
```

### For Linux (AppImage and .deb)

```bash
npm run dist:linux
```

### Build for all platforms

```bash
npm run dist
```

## What Gets Built

The build process:

1. **Pre-build checks** - Verifies Node.js and Python are installed
2. **Backend compilation** - Compiles TypeScript backend to JavaScript
3. **Frontend build** - Builds Electron renderer process
4. **Packaging** - Creates installer with:
   - Electron runtime
   - Compiled frontend and backend
   - Python virtual environment (if available)
   - Node.js backend dependencies

## Dependency Installation

When users install the application:

### Windows Installer (NSIS)
- Checks Windows registry for Node.js and Python
- Shows dialog with download links if dependencies are missing
- Users can choose to download dependencies before continuing

### First Launch
- Application checks for Node.js and Python
- Shows warning dialog if dependencies are missing
- Provides links to download pages
- Backend won't start until dependencies are installed

## Development vs Production

### Development Mode
```bash
npm run dev
```
- Uses `ts-node` to run TypeScript directly
- Uses system Python if available
- Hot reload enabled

### Production Build
- Backend TypeScript is compiled to JavaScript
- Uses bundled Python virtual environment if available
- Falls back to system Python if venv not found

## Troubleshooting

### Python Virtual Environment Not Found
If Python venv is missing, run:
```bash
npm run prepare:python
```

### Backend Build Fails
Ensure backend dependencies are installed:
```bash
cd backend
pnpm install
```

### Build Size Too Large
The build includes:
- Electron runtime (~100MB)
- Node.js backend dependencies
- Python virtual environment (if bundled, ~200MB+)

To reduce size, you can exclude the Python venv from the build and rely on system Python, but this requires users to have Python installed.

## Notes

- The Python virtual environment is bundled as an "extra resource" and can be quite large
- Users must have Node.js installed on their system (not bundled)
- Python can be bundled or use system Python
- The installer checks for dependencies but doesn't auto-install them (for security reasons)
