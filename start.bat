@echo off
CHCP 65001 >nul
TITLE Iterative Studio - Development Tools

:: 检查Node.js是否已安装
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 检查node_modules目录是否存在，如果不存在则安装依赖
echo Installing/updating dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies.
    pause
    exit /b %errorlevel%
)
echo Dependencies are up to date.

:: 显示菜单选项
:menu
echo.
echo ================= Iterative Studio Development Tools =================
echo.
echo 请选择要执行的操作:
echo 1. 启动开发服务器 (包括 DeepSeek 代理)
echo 2. 列出可用的Google GenAI模型
echo 3. 列出可用的OpenAI兼容模型
echo 4. 测试OpenAI模型功能说明
echo 5. 退出
echo.
choice /c 12345 /m "请选择一个选项"

if errorlevel 5 goto :eof
if errorlevel 4 goto :test_openai
if errorlevel 3 goto :list_openai
if errorlevel 2 goto :list_google
if errorlevel 1 goto :start_dev

:start_dev
echo "Starting development server and proxy..."
call npm run dev
goto :menu

:list_google
node list-models.js
goto :menu

:list_openai
node list-openai-models.js
goto :menu

:test_openai
node test-openai-models.js
goto :menu