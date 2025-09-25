@echo off
echo 正在检查Git状态...
git status

echo.
echo 请输入提交信息：
set /p commit_message=

echo.
echo 正在添加文件到暂存区...
git add .

echo.
echo 正在提交修改...
git commit -m "%commit_message%"

echo.
echo 正在推送到GitHub...
git push origin main

echo.
echo 提交完成！
pause
