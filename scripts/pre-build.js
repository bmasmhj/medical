/**
 * Pre-build script that ensures all dependencies are ready before building
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Running pre-build checks...\n');

// Check Node.js
try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(`✓ Node.js ${nodeVersion} found`);
} catch (error) {
    console.error('✗ Node.js not found. Please install Node.js 18+ from https://nodejs.org/');
    process.exit(1);
}

// Check Python (optional but recommended)
let pythonFound = false;
try {
    const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' }).trim();
    console.log(`✓ Python ${pythonVersion} found`);
    pythonFound = true;
} catch (error) {
    try {
        const pythonVersion = execSync('python --version', { encoding: 'utf-8' }).trim();
        console.log(`✓ Python ${pythonVersion} found`);
        pythonFound = true;
    } catch (error2) {
        console.warn('⚠ Python not found. Python features will not work unless Python is installed on the target system.');
    }
}

// Check if backend venv exists
const venvPath = path.join(__dirname, '..', 'backend', 'venv');
if (pythonFound && !fs.existsSync(venvPath)) {
    console.log('\n⚠ Python virtual environment not found. Creating...');
    try {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        execSync(`${pythonCmd} -m venv "${venvPath}"`, { stdio: 'inherit' });
        console.log('✓ Virtual environment created');
    } catch (error) {
        console.warn('⚠ Failed to create virtual environment. Continuing...');
    }
}

// Check if backend requirements are installed
if (pythonFound && fs.existsSync(venvPath)) {
    const requirementsPath = path.join(__dirname, '..', 'backend', 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
        const pipPath = process.platform === 'win32'
            ? path.join(venvPath, 'Scripts', 'pip')
            : path.join(venvPath, 'bin', 'pip');
        
        if (fs.existsSync(pipPath)) {
            console.log('\n✓ Python virtual environment ready');
        }
    }
}

console.log('\n✓ Pre-build checks complete!\n');
