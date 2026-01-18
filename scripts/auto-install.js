/**
 * Auto-install script that automatically downloads and installs all dependencies
 * including Node.js and Python, without prompting the user
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

const backendPath = path.join(__dirname, '..', 'backend');
const venvPath = path.join(backendPath, 'venv');
const requirementsPath = path.join(backendPath, 'requirements.txt');

console.log('Auto-installing dependencies...\n');

/**
 * Download a file from URL
 */
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirects
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(dest);
            });
        }).on('error', (err) => {
            if (fs.existsSync(dest)) {
                fs.unlinkSync(dest);
            }
            reject(err);
        });
        
        file.on('error', (err) => {
            if (fs.existsSync(dest)) {
                fs.unlinkSync(dest);
            }
            reject(err);
        });
    });
}

/**
 * Get latest Node.js LTS version download URL
 */
function getNodeJSDownloadUrl() {
    const platform = process.platform;
    const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'x64';
    
    // Use Node.js 20 LTS (latest stable)
    const version = '20.18.0';
    
    if (platform === 'win32') {
        return `https://nodejs.org/dist/v${version}/node-v${version}-${arch}.msi`;
    } else if (platform === 'darwin') {
        const macArch = arch === 'arm64' ? 'arm64' : 'x64';
        return `https://nodejs.org/dist/v${version}/node-v${version}-darwin-${macArch}.pkg`;
    } else {
        // Linux
        return `https://nodejs.org/dist/v${version}/node-v${version}-linux-${arch}.tar.xz`;
    }
}

/**
 * Get latest Python download URL
 */
function getPythonDownloadUrl() {
    const platform = process.platform;
    const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : 'x64';
    
    // Use Python 3.12 (stable version)
    const version = '3.12.7';
    
    if (platform === 'win32') {
        return `https://www.python.org/ftp/python/${version}/python-${version}-amd64.exe`;
    } else if (platform === 'darwin') {
        // macOS - prefer Homebrew, but provide universal installer URL
        return `https://www.python.org/ftp/python/${version}/python-${version}-macos11.pkg`;
    } else {
        // Linux - prefer package manager
        return null;
    }
}

/**
 * Install Node.js on Windows
 */
function installNodeJSWindows() {
    return new Promise((resolve, reject) => {
        console.log('Downloading Node.js installer...');
        const url = getNodeJSDownloadUrl();
        const dest = path.join(os.tmpdir(), 'nodejs-installer.msi');
        
        downloadFile(url, dest)
            .then(() => {
                console.log('Installing Node.js (this may require admin privileges)...');
                // Silent install with auto-accept
                const installProcess = spawn('msiexec', [
                    '/i', dest,
                    '/qn',           // Quiet mode
                    '/norestart',    // Don't restart
                    'ADDLOCAL=ALL'   // Install all features
                ], {
                    stdio: 'inherit',
                    shell: true
                });
                
                installProcess.on('close', (code) => {
                    fs.unlinkSync(dest);
                    if (code === 0) {
                        console.log('✓ Node.js installed successfully');
                        resolve(true);
                    } else {
                        reject(new Error(`Installation failed with code ${code}`));
                    }
                });
                
                installProcess.on('error', (err) => {
                    fs.unlinkSync(dest);
                    reject(err);
                });
            })
            .catch(reject);
    });
}

/**
 * Install Node.js on macOS
 */
function installNodeJSMacOS() {
    return new Promise((resolve, reject) => {
        // Try Homebrew first (most common on macOS)
        try {
            execSync('brew --version', { stdio: 'ignore' });
            console.log('Installing Node.js via Homebrew...');
            try {
                execSync('brew install node@20', { stdio: 'inherit' });
                console.log('✓ Node.js installed via Homebrew');
                resolve(true);
                return;
            } catch (error) {
                console.warn('Homebrew installation failed, trying direct download...');
            }
        } catch {
            console.log('Homebrew not found, downloading installer...');
        }
        
        // Fallback to PKG installer
        const url = getNodeJSDownloadUrl();
        const dest = path.join(os.tmpdir(), 'nodejs-installer.pkg');
        
        downloadFile(url, dest)
            .then(() => {
                console.log('Installing Node.js (this may require admin privileges)...');
                const installProcess = spawn('sudo', [
                    'installer',
                    '-pkg', dest,
                    '-target', '/'
                ], {
                    stdio: 'inherit',
                    shell: true
                });
                
                installProcess.on('close', (code) => {
                    fs.unlinkSync(dest);
                    if (code === 0) {
                        console.log('✓ Node.js installed successfully');
                        resolve(true);
                    } else {
                        reject(new Error(`Installation failed with code ${code}`));
                    }
                });
                
                installProcess.on('error', (err) => {
                    fs.unlinkSync(dest);
                    reject(err);
                });
            })
            .catch(reject);
    });
}

/**
 * Install Node.js on Linux
 */
function installNodeJSLinux() {
    return new Promise((resolve, reject) => {
        console.log('Installing Node.js via package manager...');
        
        // Try different package managers
        const commands = [
            { check: 'apt-get', install: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs' },
            { check: 'yum', install: 'curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs' },
            { check: 'dnf', install: 'curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo dnf install -y nodejs' },
            { check: 'pacman', install: 'sudo pacman -S --noconfirm nodejs npm' }
        ];
        
        for (const cmd of commands) {
            try {
                execSync(`which ${cmd.check}`, { stdio: 'ignore' });
                console.log(`Using ${cmd.check} to install Node.js...`);
                execSync(cmd.install, { stdio: 'inherit', shell: true });
                console.log('✓ Node.js installed successfully');
                resolve(true);
                return;
            } catch {
                continue;
            }
        }
        
        reject(new Error('No supported package manager found'));
    });
}

/**
 * Install Python on Windows
 */
function installPythonWindows() {
    return new Promise((resolve, reject) => {
        console.log('Downloading Python installer...');
        const url = getPythonDownloadUrl();
        const dest = path.join(os.tmpdir(), 'python-installer.exe');
        
        downloadFile(url, dest)
            .then(() => {
                console.log('Installing Python (this may require admin privileges)...');
                // Silent install with add to PATH
                const installProcess = spawn(dest, [
                    '/quiet',
                    'InstallAllUsers=1',
                    'PrependPath=1',
                    'Include_test=0',
                    'Include_doc=0'
                ], {
                    stdio: 'inherit',
                    shell: true
                });
                
                installProcess.on('close', (code) => {
                    fs.unlinkSync(dest);
                    if (code === 0) {
                        console.log('✓ Python installed successfully');
                        resolve(true);
                    } else {
                        reject(new Error(`Installation failed with code ${code}`));
                    }
                });
                
                installProcess.on('error', (err) => {
                    fs.unlinkSync(dest);
                    reject(err);
                });
            })
            .catch(reject);
    });
}

/**
 * Install Python on macOS
 */
function installPythonMacOS() {
    return new Promise((resolve, reject) => {
        // Try Homebrew first
        try {
            execSync('brew --version', { stdio: 'ignore' });
            console.log('Installing Python via Homebrew...');
            try {
                execSync('brew install python@3.12', { stdio: 'inherit' });
                console.log('✓ Python installed via Homebrew');
                resolve(true);
                return;
            } catch (error) {
                console.warn('Homebrew installation failed, trying direct download...');
            }
        } catch {
            console.log('Homebrew not found, downloading installer...');
        }
        
        // Fallback to PKG installer
        const url = getPythonDownloadUrl();
        const dest = path.join(os.tmpdir(), 'python-installer.pkg');
        
        downloadFile(url, dest)
            .then(() => {
                console.log('Installing Python (this may require admin privileges)...');
                const installProcess = spawn('sudo', [
                    'installer',
                    '-pkg', dest,
                    '-target', '/'
                ], {
                    stdio: 'inherit',
                    shell: true
                });
                
                installProcess.on('close', (code) => {
                    fs.unlinkSync(dest);
                    if (code === 0) {
                        console.log('✓ Python installed successfully');
                        resolve(true);
                    } else {
                        reject(new Error(`Installation failed with code ${code}`));
                    }
                });
                
                installProcess.on('error', (err) => {
                    fs.unlinkSync(dest);
                    reject(err);
                });
            })
            .catch(reject);
    });
}

/**
 * Install Python on Linux
 */
function installPythonLinux() {
    return new Promise((resolve, reject) => {
        console.log('Installing Python via package manager...');
        
        const commands = [
            { check: 'apt-get', install: 'sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv' },
            { check: 'yum', install: 'sudo yum install -y python3 python3-pip' },
            { check: 'dnf', install: 'sudo dnf install -y python3 python3-pip' },
            { check: 'pacman', install: 'sudo pacman -S --noconfirm python python-pip' }
        ];
        
        for (const cmd of commands) {
            try {
                execSync(`which ${cmd.check}`, { stdio: 'ignore' });
                console.log(`Using ${cmd.check} to install Python...`);
                execSync(cmd.install, { stdio: 'inherit', shell: true });
                console.log('✓ Python installed successfully');
                resolve(true);
                return;
            } catch {
                continue;
            }
        }
        
        reject(new Error('No supported package manager found'));
    });
}

/**
 * Auto-install Node.js
 */
async function autoInstallNodeJS() {
    const platform = process.platform;
    
    try {
        if (platform === 'win32') {
            await installNodeJSWindows();
        } else if (platform === 'darwin') {
            await installNodeJSMacOS();
        } else {
            await installNodeJSLinux();
        }
        
        // Wait a moment for PATH to update, then verify
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify installation
        try {
            const version = execSync('node --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
            console.log(`✓ Node.js ${version} verified`);
            return true;
        } catch {
            console.warn('⚠ Node.js installed but not found in PATH. You may need to restart your terminal.');
            return true; // Still consider it successful
        }
    } catch (error) {
        console.error('✗ Failed to auto-install Node.js:', error.message);
        console.warn('⚠ Please install Node.js manually from https://nodejs.org/');
        return false;
    }
}

/**
 * Auto-install Python
 */
async function autoInstallPython() {
    const platform = process.platform;
    
    try {
        if (platform === 'win32') {
            await installPythonWindows();
        } else if (platform === 'darwin') {
            await installPythonMacOS();
        } else {
            await installPythonLinux();
        }
        
        // Wait a moment for PATH to update, then verify
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify installation
        try {
            const version = execSync('python3 --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
            console.log(`✓ ${version} verified`);
            return true;
        } catch {
            try {
                const version = execSync('python --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
                console.log(`✓ ${version} verified`);
                return true;
            } catch {
                console.warn('⚠ Python installed but not found in PATH. You may need to restart your terminal.');
                return true; // Still consider it successful
            }
        }
    } catch (error) {
        console.error('✗ Failed to auto-install Python:', error.message);
        console.warn('⚠ Please install Python manually from https://www.python.org/downloads/');
        return false;
    }
}

/**
 * Check if Node.js is available
 */
function checkNodeJS() {
    try {
        const nodeVersion = execSync('node --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        console.log(`✓ Node.js ${nodeVersion} found`);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Check if Python is available and return the command
 */
function checkPython() {
    try {
        const pythonVersion = execSync('python3 --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        console.log(`✓ ${pythonVersion} found`);
        return 'python3';
    } catch (error) {
        try {
            const pythonVersion = execSync('python --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
            console.log(`✓ ${pythonVersion} found`);
            return 'python';
        } catch (error2) {
            console.warn('⚠ Python not found. Python features will be disabled.');
            return null;
        }
    }
}

/**
 * Auto-install backend npm packages
 */
function installBackendPackages() {
    const backendNodeModules = path.join(backendPath, 'node_modules');
    
    if (!fs.existsSync(backendNodeModules)) {
        console.log('\nInstalling backend npm packages...');
        try {
            // Check if pnpm is available, otherwise use npm
            let packageManager = 'npm';
            try {
                execSync('pnpm --version', { stdio: 'ignore' });
                packageManager = 'pnpm';
            } catch {
                try {
                    execSync('npm --version', { stdio: 'ignore' });
                    packageManager = 'npm';
                } catch {
                    console.error('✗ Neither pnpm nor npm found. Cannot install backend packages.');
                    return false;
                }
            }
            
            const command = process.platform === 'win32' && packageManager === 'pnpm' 
                ? 'pnpm.cmd install' 
                : `${packageManager} install`;
            
            execSync(command, { 
                cwd: backendPath, 
                stdio: 'inherit' 
            });
            console.log('✓ Backend npm packages installed');
            return true;
        } catch (error) {
            console.error('✗ Failed to install backend npm packages:', error.message);
            return false;
        }
    } else {
        console.log('✓ Backend npm packages already installed');
        return true;
    }
}

/**
 * Auto-setup Python virtual environment and install packages
 */
function setupPython() {
    const pythonCmd = checkPython();
    
    if (!pythonCmd) {
        return false;
    }
    
    if (!fs.existsSync(requirementsPath)) {
        console.log('⚠ requirements.txt not found. Skipping Python setup.');
        return false;
    }
    
    // Create virtual environment if it doesn't exist
    if (!fs.existsSync(venvPath)) {
        console.log('\nCreating Python virtual environment...');
        try {
            execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
            console.log('✓ Virtual environment created');
        } catch (error) {
            console.error('✗ Failed to create virtual environment:', error.message);
            return false;
        }
    } else {
        console.log('✓ Python virtual environment already exists');
    }
    
    // Determine pip path based on platform
    const pipPath = process.platform === 'win32' 
        ? path.join(venvPath, 'Scripts', 'pip')
        : path.join(venvPath, 'bin', 'pip');
    
    // Install requirements
    if (fs.existsSync(pipPath)) {
        console.log('\nInstalling Python dependencies...');
        try {
            execSync(`"${pipPath}" install -r "${requirementsPath}"`, { stdio: 'inherit' });
            console.log('✓ Python dependencies installed');
            return true;
        } catch (error) {
            console.error('✗ Failed to install Python dependencies:', error.message);
            console.warn('⚠ Continuing without Python dependencies. Some features may not work.');
            return false;
        }
    } else {
        console.warn('⚠ Virtual environment pip not found. Skipping Python dependency installation.');
        return false;
    }
}

/**
 * Main auto-install function
 */
async function autoInstall() {
    let nodeAvailable = checkNodeJS();
    let pythonAvailable = checkPython() !== null;
    
    // Auto-install Node.js if missing
    if (!nodeAvailable) {
        console.log('\nNode.js not found. Attempting to auto-install...');
        nodeAvailable = await autoInstallNodeJS();
    }
    
    // Auto-install Python if missing (optional)
    if (!pythonAvailable) {
        console.log('\nPython not found. Attempting to auto-install...');
        pythonAvailable = await autoInstallPython();
    }
    
    let success = true;
    
    // Install backend npm packages if Node.js is available
    if (nodeAvailable) {
        if (!installBackendPackages()) {
            success = false;
        }
    } else {
        console.error('\n✗ Node.js is required but could not be installed automatically.');
        console.error('Please install Node.js manually from https://nodejs.org/');
        success = false;
    }
    
    // Setup Python if available
    if (pythonAvailable) {
        setupPython();
    } else {
        console.warn('\n⚠ Python is optional. Some features may not work without it.');
    }
    
    console.log('\n✓ Auto-installation complete!');
    
    return {
        nodeAvailable,
        pythonAvailable,
        success
    };
}

// Run if called directly
if (require.main === module) {
    autoInstall()
        .then((result) => {
            process.exit(result.success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Fatal error during auto-installation:', error);
            process.exit(1);
        });
}

module.exports = { 
    autoInstall, 
    checkNodeJS, 
    checkPython, 
    installBackendPackages, 
    setupPython,
    autoInstallNodeJS,
    autoInstallPython
};
