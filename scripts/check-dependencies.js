const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if Node.js is installed and meets minimum version requirement
 */
function checkNodeJS() {
    try {
        const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
        const versionMatch = nodeVersion.match(/v(\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
            const major = parseInt(versionMatch[1]);
            const minor = parseInt(versionMatch[2]);
            if (major > 18 || (major === 18 && minor >= 0)) {
                console.log(`✓ Node.js ${nodeVersion} is installed`);
                return { installed: true, version: nodeVersion };
            }
        }
        console.warn(`⚠ Node.js ${nodeVersion} is installed but version 18+ is recommended`);
        return { installed: true, version: nodeVersion, warning: true };
    } catch (error) {
        console.error('✗ Node.js is not installed');
        return { installed: false };
    }
}

/**
 * Check if Python is installed and meets minimum version requirement
 */
function checkPython() {
    try {
        const python3Version = execSync('python3 --version', { encoding: 'utf-8' }).trim();
        const versionMatch = python3Version.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (versionMatch) {
            const major = parseInt(versionMatch[1]);
            const minor = parseInt(versionMatch[2]);
            if (major > 3 || (major === 3 && minor >= 8)) {
                console.log(`✓ Python ${python3Version} is installed`);
                return { installed: true, version: python3Version, command: 'python3' };
            }
        }
        console.warn(`⚠ ${python3Version} is installed but Python 3.8+ is recommended`);
        return { installed: true, version: python3Version, command: 'python3', warning: true };
    } catch (error) {
        try {
            const pythonVersion = execSync('python --version', { encoding: 'utf-8' }).trim();
            const versionMatch = pythonVersion.match(/Python (\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1]);
                const minor = parseInt(versionMatch[2]);
                if (major > 3 || (major === 3 && minor >= 8)) {
                    console.log(`✓ Python ${pythonVersion} is installed`);
                    return { installed: true, version: pythonVersion, command: 'python' };
                }
            }
            console.warn(`⚠ ${pythonVersion} is installed but Python 3.8+ is recommended`);
            return { installed: true, version: pythonVersion, command: 'python', warning: true };
        } catch (error2) {
            console.error('✗ Python is not installed');
            return { installed: false };
        }
    }
}

/**
 * Install Node.js (Windows only - shows download link for other platforms)
 */
function installNodeJS() {
    const platform = process.platform;
    
    if (platform === 'win32') {
        console.log('\nTo install Node.js on Windows:');
        console.log('1. Visit https://nodejs.org/');
        console.log('2. Download the LTS version');
        console.log('3. Run the installer');
        console.log('4. Restart this application\n');
    } else if (platform === 'darwin') {
        console.log('\nTo install Node.js on macOS:');
        console.log('1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
        console.log('2. Run: brew install node');
        console.log('3. Restart this application\n');
    } else {
        console.log('\nTo install Node.js on Linux:');
        console.log('1. Visit https://nodejs.org/');
        console.log('2. Follow installation instructions for your distribution');
        console.log('3. Restart this application\n');
    }
}

/**
 * Install Python (Windows only - shows download link for other platforms)
 */
function installPython() {
    const platform = process.platform;
    
    if (platform === 'win32') {
        console.log('\nTo install Python on Windows:');
        console.log('1. Visit https://www.python.org/downloads/');
        console.log('2. Download Python 3.8 or later');
        console.log('3. Run the installer (check "Add Python to PATH")');
        console.log('4. Restart this application\n');
    } else if (platform === 'darwin') {
        console.log('\nTo install Python on macOS:');
        console.log('1. Install Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
        console.log('2. Run: brew install python3');
        console.log('3. Restart this application\n');
    } else {
        console.log('\nTo install Python on Linux:');
        console.log('1. Run: sudo apt-get update && sudo apt-get install python3 python3-pip');
        console.log('   (or use your distribution\'s package manager)');
        console.log('2. Restart this application\n');
    }
}

/**
 * Main dependency check function
 */
function checkDependencies() {
    console.log('Checking dependencies...\n');
    
    const nodeCheck = checkNodeJS();
    const pythonCheck = checkPython();
    
    const missing = [];
    
    if (!nodeCheck.installed) {
        missing.push('Node.js');
    }
    
    if (!pythonCheck.installed) {
        missing.push('Python');
    }
    
    if (missing.length > 0) {
        console.log('\n⚠ Missing dependencies:', missing.join(', '));
        console.log('\nInstallation instructions:\n');
        
        if (!nodeCheck.installed) {
            installNodeJS();
        }
        
        if (!pythonCheck.installed) {
            installPython();
        }
        
        return false;
    }
    
    console.log('\n✓ All dependencies are installed!');
    return true;
}

// Run if called directly
if (require.main === module) {
    const allInstalled = checkDependencies();
    process.exit(allInstalled ? 0 : 1);
}

module.exports = { checkDependencies, checkNodeJS, checkPython };
