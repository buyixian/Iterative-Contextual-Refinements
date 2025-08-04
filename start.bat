@echo off
CHCP 65001 >nul
TITLE Iterative Studio - Development Server

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
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b %errorlevel%
    )
    echo Dependencies installed successfully.
) else (
    echo Dependencies already installed.
)

:: 显示菜单选项
echo.
echo ================= Iterative Studio Development Tools =================
echo.
echo 请选择要执行的操作:
echo 1. 启动开发服务器
echo 2. 列出可用的Google GenAI模型
echo 3. 列出可用的OpenAI兼容模型
echo 4. 测试OpenAI模型功能说明
echo 5. 退出
echo.
choice /c 12345 /m "请选择一个选项"

if errorlevel 5 goto :exit
if errorlevel 4 goto :test_openai
if errorlevel 3 goto :list_openai_models
if errorlevel 2 goto :list_models
if errorlevel 1 goto :start_server

:start_server
:: 启动开发服务器在后台
echo Starting the development server...
start "Vite Dev Server" cmd /c "npm run dev"

:: 等待几秒钟让服务器启动
echo Waiting for server to start...
timeout /T 5 /NOBREAK >nul

:: 打开浏览器
echo Opening browser...
start "" http://localhost:5173/

echo.
echo The development server is now running in the background.
echo To stop the server, please close the "Vite Dev Server" window or press Ctrl+C in that window.
echo.
pause
goto :eof

:list_models
:: 运行Google GenAI模型列表脚本
echo Listing available Google GenAI models...
echo.
node list-models.js
echo.
pause
goto :eof

:list_openai_models
:: 运行OpenAI兼容模型列表脚本
echo Listing available OpenAI compatible models...
echo.
node list-openai-models.js
echo.
pause
goto :eof

:test_openai
:: 显示OpenAI模型测试说明
echo.
echo ================= OpenAI模型测试说明 =================
echo.
echo 要测试OpenAI兼容模型功能，请按照以下步骤操作：
echo.
echo 1. 在项目根目录下编辑 .env 文件，设置以下变量：
echo    OPENAI_API_KEY=your_actual_api_key_here
echo    OPENAI_BASE_URL=https://api.openai.com/v1 (可选，默认值)
echo    (对于Azure OpenAI或其他提供商，请相应设置BASE_URL)
echo.
echo 2. 保存.env文件后，重新运行此脚本并选择选项3
echo.
echo 3. 或者直接在Web界面中：
echo    - 选择"OpenAI Compatible"作为AI提供商
echo    - 输入您的API密钥
echo    - 如果需要，设置自定义Base URL和模型名称
echo    - 点击"Save Key"按钮
echo.
echo 注意：您也可以通过环境变量API_KEY来设置密钥
echo.
pause
goto :eof

:exit
echo Exiting...
exit /b 0