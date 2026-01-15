/**
 * Post-installation script that runs when the app is first launched
 * Checks for dependencies and guides user to install them if needed
 */

const { execSync } = require('child_process');
const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const DEPENDENCY_CHECK_FILE = path.join(app.getPath('userData'), '.dependencies-checked');

function checkNodeJS() {
    try {
        execSync('node --version', { stdio: 'ignore' });
        return { installed: true };
    } catch {
        return { installed: false };
    }
}

function checkPython() {
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        return { installed: true, command: 'python3' };
    } catch {
        try {
            execSync('python --version', { stdio: 'ignore' });
            return { installed: true, command: 'python' };
        } catch {
            return { installed: false };
        }
    }
}

function showDependencyDialog(missing) {
    const platform = process.platform;
    let message = `The following dependencies are missing: ${missing.join(', ')}\n\n`;
    
    if (missing.includes('Node.js')) {
        message += 'Node.js: https://nodejs.org/\n';
    }
    
    if (missing.includes('Python')) {
        message += 'Python: https://www.python.org/downloads/\n';
    }
    
    message += '\nPlease install the missing dependencies and restart the application.';
    
    dialog.showMessageBox({
        type: 'warning',
        title: 'Missing Dependencies',
        message: 'Required Dependencies Missing',
        detail: message,
        buttons: ['Open Download Pages', 'OK']
    }).then(result => {
        if (result.response === 0) {
            // Open download pages
            if (missing.includes('Node.js')) {
                require('electron').shell.openExternal('https://nodejs.org/');
            }
            if (missing.includes('Python')) {
                require('electron').shell.openExternal('https://www.python.org/downloads/');
            }
        }
    });
}

function checkDependencies() {
    // Skip check if already done (unless forced)
    if (fs.existsSync(DEPENDENCY_CHECK_FILE) && !process.env.FORCE_DEPENDENCY_CHECK) {
        return true;
    }
    
    const nodeCheck = checkNodeJS();
    const pythonCheck = checkPython();
    
    const missing = [];
    if (!nodeCheck.installed) missing.push('Node.js');
    if (!pythonCheck.installed) missing.push('Python');
    
    if (missing.length > 0) {
        showDependencyDialog(missing);
        // Don't mark as checked if dependencies are missing
        return false;
    }
    
    // Mark as checked
    fs.writeFileSync(DEPENDENCY_CHECK_FILE, new Date().toISOString());
    return true;
}

module.exports = { checkDependencies };
