Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batchFile = scriptDir & "\start-server-and-watcher.bat"

' Argumen 0 berarti Hidden (tanpa jendela CMD), False berarti non-blocking
WshShell.Run """" & batchFile & """", 0, False
