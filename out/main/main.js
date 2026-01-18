"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const child_process = require("child_process");
const fs = require("fs");
const icon = "/icon.png";
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
let backendProcess;
function getBackendPath() {
  if (utils.is.dev) {
    return path.join(process.cwd(), "backend");
  } else {
    return path.join(process.resourcesPath, "app", "backend");
  }
}
function getPythonPath() {
  const backendPath = getBackendPath();
  const venvPath = path.join(backendPath, "venv");
  if (process.platform === "win32") {
    const pythonPath = path.join(venvPath, "Scripts", "python.exe");
    if (fs.existsSync(pythonPath)) {
      return pythonPath;
    }
  } else {
    const pythonPath = path.join(venvPath, "bin", "python");
    if (fs.existsSync(pythonPath)) {
      return pythonPath;
    }
  }
  try {
    child_process.execSync("python3 --version", { stdio: "ignore" });
    return "python3";
  } catch {
    try {
      child_process.execSync("python --version", { stdio: "ignore" });
      return "python";
    } catch {
      return null;
    }
  }
}
function checkNodeJS() {
  try {
    child_process.execSync("node --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function autoInstallDependencies() {
  const path2 = require("path");
  const fs2 = require("fs");
  const autoInstallScript = path2.join(__dirname, "../../scripts/auto-install.js");
  if (fs2.existsSync(autoInstallScript)) {
    try {
      const { autoInstall } = require(autoInstallScript);
      const result = await autoInstall();
      return result.success;
    } catch (error) {
      console.error("Failed to run auto-install script:", error);
      return checkNodeJS();
    }
  } else {
    console.warn("Auto-install script not found, using basic checks");
    return checkNodeJS();
  }
}
function startBackend() {
  const backendPath = getBackendPath();
  console.log("Starting backend at:", backendPath);
  autoInstallDependencies().catch((error) => {
    console.error("Failed to auto-install dependencies:", error);
  }).finally(() => {
    if (!checkNodeJS()) {
      console.error("Node.js is required but not found. Please install Node.js from https://nodejs.org/");
      return;
    }
    if (utils.is.dev) {
      const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
      backendProcess = child_process.spawn(command, ["start"], {
        cwd: backendPath,
        stdio: "inherit",
        shell: true
      });
    } else {
      const serverPath = path.join(backendPath, "server.js");
      if (fs.existsSync(serverPath)) {
        backendProcess = child_process.spawn("node", [serverPath], {
          cwd: backendPath,
          stdio: "inherit",
          shell: true,
          env: {
            ...process.env,
            PYTHON_PATH: getPythonPath() || ""
          }
        });
      } else {
        console.error("Backend server.js not found at:", serverPath);
        const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
        backendProcess = child_process.spawn(command, ["start"], {
          cwd: backendPath,
          stdio: "inherit",
          shell: true
        });
      }
    }
    backendProcess.on("error", (err) => {
      console.error("Failed to start backend:", err);
    });
    backendProcess.on("exit", (code) => {
      console.log("Backend process exited with code:", code);
    });
  });
}
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}
electron.app.whenReady().then(async () => {
  utils.electronApp.setAppUserModelId("com.electron");
  if (checkNodeJS()) {
    startBackend();
  } else {
    console.error("Node.js is required but not found. Please install Node.js from https://nodejs.org/");
    electron.dialog.showMessageBox({
      type: "error",
      title: "Node.js Required",
      message: "Node.js is required to run this application",
      detail: "Please install Node.js from https://nodejs.org/ and restart the application.",
      buttons: ["Open Download Page", "OK"]
    }).then((result) => {
      if (result.response === 0) {
        electron.shell.openExternal("https://nodejs.org/");
      }
    });
  }
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  stopBackend();
});
