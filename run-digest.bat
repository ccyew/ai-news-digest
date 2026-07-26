@echo off
cd /d "%~dp0"
echo ---- Run started %date% %time% ---- >> "%~dp0output\run.log"
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\tsx\dist\cli.mjs" "%~dp0src\index.ts" >> "%~dp0output\run.log" 2>&1
echo ---- Run finished %date% %time% ---- >> "%~dp0output\run.log"
