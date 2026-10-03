@echo off
title Telegram Member Remover Dashboard
echo ======================================================
echo   Telegram Cross-Channel Member Auditor ^& Remover
echo ======================================================
echo.
echo Installing/Checking Dependencies...
pip install -r requirements.txt
echo.
echo Starting Web Dashboard on http://localhost:8080 ...
python main.py
pause
