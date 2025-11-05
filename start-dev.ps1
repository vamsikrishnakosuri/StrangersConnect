# PowerShell script to start both servers for development

Write-Host "🚀 Starting Strangers Connect Development Environment..." -ForegroundColor Green
Write-Host ""

# Start Socket.io server in background
Write-Host "Starting Socket.io server on port 3001..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npm run dev"

# Wait a bit for server to start
Start-Sleep -Seconds 3

# Start Next.js frontend
Write-Host "Starting Next.js frontend on port 3000..." -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Both servers should be running now!" -ForegroundColor Green
Write-Host "📱 Open http://localhost:3000 in your browser" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the frontend server" -ForegroundColor Gray

cd $PSScriptRoot
npm run dev

