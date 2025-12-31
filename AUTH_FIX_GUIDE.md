# Niraiva Authentication & Routing - Complete Fix Guide

## Current Status
- **Frontend**: Deployed on Vercel (niraiva-app.vercel.app)
- **Backend**: Deployed on Render (https://niraiva.onrender.com)
- **Auth**: Supabase
- **Issue**: OAuth 404 on /auth/callback + API calls failing

---

## ROOT CAUSES & FIXES

### 1. **404 on /auth/callback (OAuth Redirect Issue)**

**Why it happens:**
- Vercel isn't forwarding unknown routes to index.html
- /auth/callback route doesn't exist in deployed build

**Status**: ✅ FIXED
- vercel.json with rewrites: `/(.*)` → `/index.html`
- AuthCallback component exists
- React Router handles the route

**What you need to do in Supabase Dashboard:**

Go to: **Authentication → URL Configuration**

Set these EXACTLY:
```
Site URL: https://niraiva-app.vercel.app
Redirect URLs:
  https://niraiva-app.vercel.app/auth/callback
  https://niraiva-app.vercel.app/login
  https://niraiva-app.vercel.app/dashboard
```

⚠️ **No trailing slashes. Must match exactly.**

---

### 2. **API Calls Returning 404 (Backend Connection)**

**Why it happens:**
```
Frontend env (local): VITE_API_BASE_URL=http://localhost:5000 ❌
```

When deployed, it still tries localhost!

**Status**: ✅ FIXED IN CODE
```
New value: VITE_API_BASE_URL=https://niraiva.onrender.com
```

**What you need to do in Vercel Dashboard:**

1. Go to your Niraiva project
2. Settings → Environment Variables
3. Add/Update:
```
VITE_API_BASE_URL=https://niraiva.onrender.com
VITE_SUPABASE_URL=https://fiacksuegpcpvtxucujd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
4. Redeploy

---

### 3. **Auth Flow Issues**

**Status**: ✅ FIXED IN CODE

Code changes in AuthContext.tsx:
- ✅ ensureUserInitialized() on signIn()
- ✅ ensureUserInitialized() on signUp()  
- ✅ ensureUserInitialized() on SIGNED_IN/INITIAL_SESSION events
- ✅ Role-based redirect to /dashboard (patient) or /doctor/dashboard (doctor)

---

## COMPLETE STEP-BY-STEP FIX

### Step 1: Vercel Environment Variables

1. Go to https://vercel.com → Dashboard → niraiva-app
2. Settings → Environment Variables
3. Add these (or update if they exist):

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://niraiva.onrender.com` |
| `VITE_SUPABASE_URL` | `https://fiacksuegpcpvtxucujd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpYWNrc3VlZ3BjcHZ0eHVjdWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NDcyNTYsImV4cCI6MjA3NDUyMzI1Nn0.sPNlngv8EdjpCXNtQQuS-dW9wh1n0sfr5qPTNpuJnYs` |

4. Click Save
5. Go to Deployments → Redeploy latest

### Step 2: Supabase Configuration

1. Go to https://supabase.com → Dashboard → Your Project
2. Click **Authentication** (left menu)
3. Click **URL Configuration** (second option)
4. Set **Site URL**:
   ```
   https://niraiva-app.vercel.app
   ```
5. Under "Redirect URLs", add (click "Add URL" button):
   ```
   https://niraiva-app.vercel.app/auth/callback
   https://niraiva-app.vercel.app/login
   https://niraiva-app.vercel.app/dashboard
   ```
6. Click **Save**

### Step 3: Test Email Login

1. Go to https://niraiva-app.vercel.app/login (wait for Vercel redeploy to finish)
2. Email: `testpatient@gmail.com` Password: `YourPassword123`
3. Should redirect to `/dashboard` (patient portal)
4. Check console - should see no 404 errors
5. Profile should load with health data

### Step 4: Test Google Login

1. Go to https://niraiva-app.vercel.app/login
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Should redirect to https://niraiva-app.vercel.app/auth/callback (React handles it)
5. Then redirect to `/dashboard` (patient portal)
6. Check console - should see logs:
   ```
   [AuthContext] Creating missing user_profiles entry for: ...
   [AuthContext] Creating missing user_roles entry for: ...
   ```

---

## Expected Behavior After Fix

| Flow | Before | After |
|------|--------|-------|
| Email login | Redirect to landing page ❌ | Redirect to /dashboard ✅ |
| Google login | 404 on /auth/callback ❌ | Redirect to /dashboard ✅ |
| API calls | "Failed to load reports" (404) ❌ | Reports load ✅ |
| Profile | null (crash) ❌ | Auto-created, loads ✅ |

---

## Troubleshooting

If still getting 404 on /auth/callback:
- ✅ Verify vercel.json rewrites are deployed
- ✅ Check Vercel Deployments - ensure latest is "Ready"
- ✅ Hard refresh: Ctrl+Shift+R or Cmd+Shift+R
- ✅ Check Supabase redirect URLs (typos?)

If API calls still fail (404):
- ✅ Check Vercel env vars were set
- ✅ Check Vercel was redeployed (must redeploy after setting env vars)
- ✅ Verify https://niraiva.onrender.com is accessible (check Render dashboard)

If Google login opens Google popup but doesn't redirect:
- ✅ Check browser console for errors
- ✅ Verify Supabase "Redirect URLs" includes `https://niraiva-app.vercel.app/auth/callback`
- ✅ Check Supabase "Site URL" is exactly `https://niraiva-app.vercel.app` (no trailing slash)

---

## Code Commits Deployed

- `60fe466` - Auto-initialize on signIn/signUp
- `a7a8cfb` - Auto-initialize on auth state change
- `34d5a10` - Root vercel.json
- `ae47683` - Null safety fixes

All code is production-ready. Just need external configuration.
