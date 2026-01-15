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
        // In production, backend is bundled with the app
        return joinPath(process.resourcesPath, 'app', 'backend');
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
 * Show dependency check dialog
 */
function showDependencyDialog(missing: string[]) {
    const dialog = require('electron').dialog;
    dialog.showMessageBox({
        type: 'warning',
        title: 'Missing Dependencies',
        message: `The following dependencies are missing: ${missing.join(', ')}`,
        detail: 'Please install the missing dependencies and restart the application.\n\n' +
                'Node.js: https://nodejs.org/\n' +
                'Python: https://www.python.org/downloads/',
        buttons: ['OK']
    });
}

function startBackend() {
    const backendPath = getBackendPath();
    console.log('Starting backend at:', backendPath);

    // Check dependencies
    const missingDeps: string[] = [];
    if (!checkNodeJS()) {
        missingDeps.push('Node.js');
    }
    if (!checkPython()) {
        missingDeps.push('Python');
    }

    if (missingDeps.length > 0) {
        console.error('Missing dependencies:', missingDeps.join(', '));
        showDependencyDialog(missingDeps);
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
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Check dependencies before starting backend
    const missingDeps: string[] = [];
    if (!checkNodeJS()) {
        missingDeps.push('Node.js');
    }
    if (!checkPython()) {
        missingDeps.push('Python');
    }

    if (missingDeps.length === 0) {
        startBackend();
    } else {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Missing Dependencies',
            message: `The following dependencies are missing: ${missingDeps.join(', ')}`,
            detail: 'Please install the missing dependencies and restart the application.\n\n' +
                    'Node.js: https://nodejs.org/\n' +
                    'Python: https://www.python.org/downloads/',
            buttons: ['Open Download Pages', 'OK']
        }).then((result: any) => {
            if (result.response === 0) {
                if (missingDeps.includes('Node.js')) {
                    shell.openExternal('https://nodejs.org/');
                }
                if (missingDeps.includes('Python')) {
                    shell.openExternal('https://www.python.org/downloads/');
                }
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
