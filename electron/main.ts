import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '/icon.png'
import { spawn, execSync } from 'child_process'
import { join as joinPath } from 'path'
import { existsSync } from 'fs'
import { dialog } from 'electron'

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// Start Backend Process
let backendProcess;

/**
 * Get the backend path - handles both dev and production builds
 */
function getBackendPath(): string {
    if (is.dev) {
        return joinPath(process.cwd(), 'backend');
    } else {
        // In production, backend is bundled with the app (resources/backend)
        return joinPath(process.resourcesPath, 'backend');
    }
}

/**
 * Get Python executable path - handles bundled venv
 */
function getPythonPath(): string | null {
    const backendPath = getBackendPath();
    const venvPath = joinPath(backendPath, 'venv');
    
    if (process.platform === 'win32') {
        const pythonPath = joinPath(venvPath, 'Scripts', 'python.exe');
        if (existsSync(pythonPath)) {
            return pythonPath;
        }
    } else {
        const pythonPath = joinPath(venvPath, 'bin', 'python');
        if (existsSync(pythonPath)) {
            return pythonPath;
        }
    }
    
    // Fallback to system Python
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        return 'python3';
    } catch {
        try {
            execSync('python --version', { stdio: 'ignore' });
            return 'python';
        } catch {
            return null;
        }
    }
}

/**
 * Check if Node.js is available
 */
function checkNodeJS(): boolean {
    try {
        execSync('node --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if Python is available
 */
function checkPython(): boolean {
    return getPythonPath() !== null;
}

/**
 * Auto-install dependencies including Node.js and Python
 */
async function autoInstallDependencies() {
    const path = require('path');
    const fs = require('fs');
    
    // Use the enhanced auto-install script
    const autoInstallScript = path.join(__dirname, '../../scripts/auto-install.js');
    
    if (fs.existsSync(autoInstallScript)) {
        try {
            const { autoInstall } = require(autoInstallScript);
            const result = await autoInstall();
            return result.success;
        } catch (error) {
            console.error('Failed to run auto-install script:', error);
            // Fallback to basic checks
            return checkNodeJS();
        }
    } else {
        // Fallback if script doesn't exist
        console.warn('Auto-install script not found, using basic checks');
        return checkNodeJS();
    }
}

function startBackend() {
    const backendPath = getBackendPath();
    console.log('Starting backend at:', backendPath);

    // Auto-install dependencies first, then start backend
    autoInstallDependencies().catch((error) => {
        console.error('Failed to auto-install dependencies:', error);
        // Continue anyway - try to start backend
    }).finally(() => {
        // Check if Node.js is available (required for backend)
        if (!checkNodeJS()) {
            console.error('Node.js is required but not found. Please install Node.js from https://nodejs.org/');
            return;
        }

        // In dev, use tsx/ts-node. In prod, use compiled JS with node
        if (is.dev) {
            const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
            backendProcess = spawn(command, ['start'], {
                cwd: backendPath,
                stdio: 'inherit',
                shell: true
            });
        } else {
            // In production, run the compiled server.js directly
            const serverPath = joinPath(backendPath, 'server.js');
            if (existsSync(serverPath)) {
                backendProcess = spawn('node', [serverPath], {
                    cwd: backendPath,
                    stdio: 'inherit',
                    shell: true,
                    env: {
                        ...process.env,
                        PYTHON_PATH: getPythonPath() || ''
                    }
                });
            } else {
                console.error('Backend server.js not found at:', serverPath);
                // Fallback to ts-node if available
                const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
                backendProcess = spawn(command, ['start'], {
                    cwd: backendPath,
                    stdio: 'inherit',
                    shell: true
                });
            }
        }

        backendProcess.on('error', (err) => {
            console.error('Failed to start backend:', err);
        });

        backendProcess.on('exit', (code) => {
            console.log('Backend process exited with code:', code);
        });
    });
}

function stopBackend() {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Auto-install dependencies and start backend
    // Only Node.js is required - Python is optional
    if (checkNodeJS()) {
        startBackend();
    } else {
        console.error('Node.js is required but not found. Please install Node.js from https://nodejs.org/');
        dialog.showMessageBox({
            type: 'error',
            title: 'Node.js Required',
            message: 'Node.js is required to run this application',
            detail: 'Please install Node.js from https://nodejs.org/ and restart the application.',
            buttons: ['Open Download Page', 'OK']
        }).then((result: any) => {
            if (result.response === 0) {
                shell.openExternal('https://nodejs.org/');
            }
        });
    }

    if(checkPython()) {
        console.log('Python is available for backend operations.');
    }else{
        dialog.showMessageBox({
            type: 'warning',
            title: 'Python Not Found',
            message: 'Python is not found on your system.',
            detail: 'Some backend features may not work properly without Python. Please install Python from https://www.python.org/downloads/.',
            buttons: ['Open Download Page', 'OK']
        }).then((result: any) => {
            if (result.response === 0) {
                shell.openExternal('https://www.python.org/downloads/');
            }
        });
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    stopBackend();
});
