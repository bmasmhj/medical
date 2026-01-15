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
function checkPython() {
  return getPythonPath() !== null;
}
function showDependencyDialog(missing) {
  const dialog2 = require("electron").dialog;
  dialog2.showMessageBox({
    type: "warning",
    title: "Missing Dependencies",
    message: `The following dependencies are missing: ${missing.join(", ")}`,
    detail: "Please install the missing dependencies and restart the application.\n\nNode.js: https://nodejs.org/\nPython: https://www.python.org/downloads/",
    buttons: ["OK"]
  });
}
function startBackend() {
  const backendPath = getBackendPath();
  console.log("Starting backend at:", backendPath);
  const missingDeps = [];
  if (!checkNodeJS()) {
    missingDeps.push("Node.js");
  }
  if (!checkPython()) {
    missingDeps.push("Python");
  }
  if (missingDeps.length > 0) {
    console.error("Missing dependencies:", missingDeps.join(", "));
    showDependencyDialog(missingDeps);
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
}
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  const missingDeps = [];
  if (!checkNodeJS()) {
    missingDeps.push("Node.js");
  }
  if (!checkPython()) {
    missingDeps.push("Python");
  }
  if (missingDeps.length === 0) {
    startBackend();
  } else {
    electron.dialog.showMessageBox({
      type: "warning",
      title: "Missing Dependencies",
      message: `The following dependencies are missing: ${missingDeps.join(", ")}`,
      detail: "Please install the missing dependencies and restart the application.\n\nNode.js: https://nodejs.org/\nPython: https://www.python.org/downloads/",
      buttons: ["Open Download Pages", "OK"]
    }).then((result) => {
      if (result.response === 0) {
        if (missingDeps.includes("Node.js")) {
          electron.shell.openExternal("https://nodejs.org/");
        }
        if (missingDeps.includes("Python")) {
          electron.shell.openExternal("https://www.python.org/downloads/");
        }
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
