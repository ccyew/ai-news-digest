@echo off
cd /d "%~dp0"
echo ---- Run started %date% %time% ---- >> "%~dp0output\run.log"
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0src\index.ts" >> "%~dp0output\run.log" 2>&1
echo ---- Run finished %date% %time% ---- >> "%~dp0output\run.log"

echo ---- Publishing to GitHub Pages %date% %time% ---- >> "%~dp0output\run.log"
"C:\Program Files\Git\cmd\git.exe" add -A >> "%~dp0output\run.log" 2>&1
"C:\Program Files\Git\cmd\git.exe" commit -m "Daily digest update %date%" >> "%~dp0output\run.log" 2>&1
"C:\Program Files\Git\cmd\git.exe" push origin main >> "%~dp0output\run.log" 2>&1
echo ---- Publish finished %date% %time% ---- >> "%~dp0output\run.log"

echo ---- Sending email %date% %time% ---- >> "%~dp0output\run.log"
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0src\send-email.ts" >> "%~dp0output\run.log" 2>&1
echo ---- Email step finished %date% %time% ---- >> "%~dp0output\run.log"
