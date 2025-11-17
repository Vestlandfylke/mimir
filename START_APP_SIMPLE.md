# Simple Way to Start the Application Locally

Since your backend is starting correctly, here's the easiest way to run the full application:

## Option 1: Two Terminal Windows (Simplest)

### Terminal 1 - Start Backend:
```powershell
cd webapi
dotnet run
```

Wait until you see:
```
Now listening on: https://localhost:40443
Application started. Press Ctrl+C to shut down.
```

### Terminal 2 - Start Frontend:
```powershell
cd webapp
yarn install    # Only needed first time or when dependencies change
yarn start
```

The frontend will automatically open in your browser at http://localhost:3000

---

## Option 2: Use the Existing Scripts Separately

### Start Backend:
```powershell
.\scripts\Start-Backend.ps1
```

### Start Frontend (in a new terminal):
```powershell
.\scripts\Start-Frontend.ps1
```

---

## Why Start.ps1 Isn't Working

The `Start.ps1` script has an issue - it's trying to start the backend in a new window with:
```powershell
Start-Process pwsh -ArgumentList "-command ""& '$BackendScript'"""
```

But this may not work properly on all systems. The manual two-terminal approach is more reliable.

---

## Quick Verification

### 1. Check Backend is Running:
Open browser and go to: https://localhost:40443/healthz

You should see: `Healthy`

(You may need to accept the certificate warning - this is normal for local development)

### 2. Check Frontend is Running:
The frontend should automatically open at: http://localhost:3000

If not, manually navigate to: http://localhost:3000

---

## Current Status

Based on your terminal output:
- ✅ Backend built successfully
- ✅ Backend is running on https://localhost:40443
- ✅ Health probe is available
- ⚠️ Plugin warning (not critical - just can't load a plugin, app continues)

**Next step:** Start the frontend in a new terminal!

---

## Troubleshooting the Plugin Warning

If you want to fix the plugin warning, edit `webapi/appsettings.json` and find the `Plugins` section:

```json
"Plugins": [
  {
    
  }
],
```

Change it to an empty array:
```json
"Plugins": [],
```

But this is optional - the warning doesn't prevent the app from working.

---

## For Future: Fix Start.ps1 (Optional)

If you want to fix the `Start.ps1` script for easier startup, the issue is on line 35. It tries to start in a new process but sometimes the port detection fails.

A simpler approach would be to use Windows Terminal or just manually start both in separate terminals as shown above.

