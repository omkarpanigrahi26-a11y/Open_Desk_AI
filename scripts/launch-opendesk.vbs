' OpenDesk AI Silent Windows Background Launcher
' Starts the backend, frontend, and electron desktop workstation without command prompt popup windows
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get project directory from current script location
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

WshShell.CurrentDirectory = projectDir
' Run npm run dev invisibly (0 = hide window, False = don't block execution)
WshShell.Run "cmd.exe /c npm run dev", 0, False
