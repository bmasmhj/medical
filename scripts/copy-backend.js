const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
    if (fs.existsSync(src)) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((item) => {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            if (fs.lstatSync(srcPath).isDirectory()) {
                copyRecursiveSync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }
}

const backendDist = path.join(__dirname, '../backend/dist');
const target = path.join(__dirname, '../backend');
console.log('Copying backend/dist to backend/...');
copyRecursiveSync(backendDist, target);
console.log('Backend copied successfully.');