; NSIS Installer Script for Medical App
!include "LogicLib.nsh"
; This script runs during installation to check and install dependencies

!macro CheckAndInstallDependencies
    ; Check for Node.js
    ReadRegStr $0 HKLM "SOFTWARE\Node.js" ""
    ${If} $0 == ""
        ; Node.js not found, show message
        MessageBox MB_YESNO|MB_ICONQUESTION "Node.js is not installed.$\n$\nWould you like to download Node.js installer now?" IDYES download_node
        Goto check_python
        download_node:
            ExecShell "open" "https://nodejs.org/"
    ${EndIf}
    
    check_python:
    ; Check for Python
    ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.11\InstallPath" ""
    ${If} $0 == ""
        ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.10\InstallPath" ""
        ${If} $0 == ""
            ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.9\InstallPath" ""
            ${If} $0 == ""
                ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.8\InstallPath" ""
                ${If} $0 == ""
                    ; Python not found, show message
                    MessageBox MB_YESNO|MB_ICONQUESTION "Python 3.8+ is not installed.$\n$\nWould you like to download Python installer now?" IDYES download_python
                    Goto end_check
                    download_python:
                        ExecShell "open" "https://www.python.org/downloads/"
                ${EndIf}
            ${EndIf}
        ${EndIf}
    ${EndIf}
    
    end_check:
!macroend

; Function to run after installation
Function .onInstSuccess
    MessageBox MB_YESNO|MB_ICONQUESTION "Installation completed!$\n$\nWould you like to launch the application now?" IDNO skip_launch
    Exec "$INSTDIR\${PRODUCT_NAME}.exe"
    skip_launch:
FunctionEnd

; Function to check dependencies before installation
!macro customInit
    ; Call the macro to check dependencies
    !insertmacro CheckAndInstallDependencies
!macroend
