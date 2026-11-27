' Starts the deck analyzer server with no console window. Output goes to server.log.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run "cmd /c node server.mjs > server.log 2>&1", 0, False
