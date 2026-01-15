const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendPath = path.join(__dirname, '..', 'backend');
const venvPath = path.join(backendPath, 'venv');
const requirementsPath = path.join(backendPath, 'requirements.txt');

console.log('Preparing Python environment...');

// Check if Python is available
function checkPython() {
    try {
        const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' });
        console.log('Found Python:', pythonVersion.trim());
        return 'python3';
    } catch (e) {
        try {
            const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
            console.log('Found Python:', pythonVersion.trim());
            return 'python';
        } catch (e2) {
            console.warn('Python not found. Please install Python 3.8+ to use Python features.');
            return null;
        }
    }
}

const pythonCmd = checkPython();

if (pythonCmd && fs.existsSync(requirementsPath)) {
    // Create virtual environment if it doesn't exist
    if (!fs.existsSync(venvPath)) {
        console.log('Creating Python virtual environment...');
        try {
            execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
        } catch (error) {
            console.error('Failed to create virtual environment:', error.message);
            process.exit(1);
        }
    }

    // Determine pip path based on platform
    const pipPath = process.platform === 'win32' 
        ? path.join(venvPath, 'Scripts', 'pip')
        : path.join(venvPath, 'bin', 'pip');

    // Install requirements
    if (fs.existsSync(pipPath)) {
        console.log('Installing Python dependencies...');
        try {
            execSync(`"${pipPath}" install -r "${requirementsPath}"`, { stdio: 'inherit' });
            console.log('Python dependencies installed successfully.');
        } catch (error) {
            console.error('Failed to install Python dependencies:', error.message);
            console.warn('Continuing without Python dependencies. Some features may not work.');
        }
    } else {
        console.warn('Virtual environment pip not found. Skipping Python dependency installation.');
    }
} else {
    console.warn('Python or requirements.txt not found. Skipping Python setup.');
}

console.log('Python environment preparation complete.');
