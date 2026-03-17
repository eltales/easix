@echo off
wsl -e bash -lc "cd /home/projekty/easix && bash setup.sh && npm run tauri dev"
