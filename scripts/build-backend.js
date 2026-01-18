const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building backend...');

const backendPath = path.join(__dirname, '..', 'backend');

try {
    // Change to backend directory and build
    process.chdir(backendPath);
    
    // Install backend dependencies if node_modules doesn't exist
    if (!fs.existsSync(path.join(backendPath, 'node_modules'))) {
        console.log('Installing backend dependencies...');
        try {
            // Try pnpm first, fallback to npm
            try {
                execSync('pnpm --version', { stdio: 'ignore' });
                const command = process.platform === 'win32' ? 'pnpm.cmd install' : 'pnpm install';
                execSync(command, { stdio: 'inherit' });
            } catch {
                execSync('npm install', { stdio: 'inherit' });
            }
        } catch (error) {
            console.error('Failed to install backend dependencies:', error.message);
            throw error;
        }
    }
    
    // Build TypeScript
    console.log('Compiling TypeScript...');
    execSync('pnpm run build', { stdio: 'inherit' });
    
    console.log('Backend build complete!');
} catch (error) {
    console.error('Backend build failed:', error.message);
    process.exit(1);
}
