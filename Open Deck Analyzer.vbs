' Double-click to open the deck analyzer.
' Starts the server in the background if it is not already running, then opens http://localhost:3000.
' A server started here shuts itself down after 90 minutes with no page open.
Const APP_URL = "http://localhost:3000/"

Function IsUp()
  On Error Resume Next
  Dim x : Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 1000, 1000, 1000, 1000
  x.open "GET", APP_URL & "style.css", False
  x.send
  IsUp = (Err.Number = 0 And x.status = 200)
  Err.Clear
End Function

Set sh = CreateObject("WScript.Shell")
If Not IsUp() Then
  Set fso = CreateObject("Scripting.FileSystemObject")
  sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
  sh.Run "cmd /c node server.mjs --idle-exit=90 > server.log 2>&1", 0, False
  For i = 1 To 40          ' wait up to ~20s (first run with no data takes longer)
    WScript.Sleep 500
    If IsUp() Then Exit For
  Next
End If
sh.Run APP_URL
