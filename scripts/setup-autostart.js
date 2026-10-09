const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function setupAutoStart() {
  const appData = process.env.APPDATA;
  if (!appData) {
    console.error('APPDATA environment variable not found.');
    return;
  }

  const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  if (!fs.existsSync(startupDir)) {
    console.error('Windows Startup folder does not exist at:', startupDir);
    return;
  }

  const rootDir = path.resolve(__dirname, '..');
  const startupVbsTarget = path.join(startupDir, 'OpenDeskAI.vbs');

  // Create persistent silent background launch script inside Windows Startup folder
  const vbsContent = `' OpenDesk AI Windows Boot Autostart
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${rootDir.replace(/\\/g, '\\\\')}"
WshShell.Run "cmd.exe /c npm run dev", 0, False
`;

  fs.writeFileSync(startupVbsTarget, vbsContent, 'utf-8');
  console.log('[AutoLaunch] Successfully created Windows Startup file:', startupVbsTarget);

  // Register in Windows Registry Run key
  const regCommand = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "OpenDeskAI" /t REG_SZ /d "wscript.exe \\"${startupVbsTarget}\\"" /f`;
  try {
    const out = execSync(regCommand, { encoding: 'utf-8' });
    console.log('[AutoLaunch] Windows Registry updated:', out.trim());
  } catch (err) {
    console.warn('[AutoLaunch] Registry notice:', err.message);
  }
}

setupAutoStart();
