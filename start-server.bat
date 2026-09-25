@echo off
chcp 65001 >nul
title COSMIC PORTFOLIO - Local Server
cd /d "%~dp0"

echo.
echo  ==========================================================
echo    COSMIC PORTFOLIO  //  Local Development Server
echo  ==========================================================
echo.
echo    Public site : http://localhost:5500
echo    Admin panel : http://localhost:5500/admin.html
echo.
echo    Press Ctrl + C to stop the server.
echo  ==========================================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:5500
    py -m http.server 5500
    goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:5500
    python -m http.server 5500
    goto :end
)

where npx >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:5500
    npx --yes serve -l 5500
    goto :end
)

echo  [!] Python and Node.js were not found on this computer.
echo.
echo      Install one of these, then run this file again:
echo        Python  https://www.python.org/downloads/
echo        Node.js https://nodejs.org/
echo.
echo      Or open this folder in VS Code and use the
echo      "Live Server" extension instead.
echo.
pause

:end
