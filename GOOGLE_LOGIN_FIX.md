# STRICT FIX FOR GOOGLE LOGIN 404 ERROR

## Root Cause
Vercel is returning 404 before routing to `/auth/callback` because the rewrite rules weren't being applied correctly.

## What Was Just Fixed (Deployed)

✅ **Root vercel.json** - Enhanced with:
- Explicit build commands
- Environment variable references
- Multiple fallback rewrite rules

✅ **frontend/vercel.json** - Updated with:
- `"cleanUrls": true` - Forces SPA routing

✅ **frontend/public/_redirects** - Created:
- Tells Vercel to always serve `/index.html` for unknown routes

## What You MUST Do Now

### STEP 1: Force Vercel to Recognize New Config

1. Go to https://vercel.com → niraiva-app
2. Go to **Settings** → scroll down to **Git** section
3. Find **Deployment Ignored Build Step** and clear it (if set)
4. Click **Deployments** tab
5. Click the **three dots** on the latest deployment → **Redeploy** (not just rebuild)
6. **WAIT** for deployment to complete (should take 2-3 minutes)

✅ Check deployment is "Ready" before testing

### STEP 2: Test Google Login

1. Go to https://niraiva-app.vercel.app/login
2. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Click **"Sign in with Google"**
4. Complete Google OAuth flow
5. **Expected**: Redirect to `https://niraiva-app.vercel.app/auth/callback?code=...&state=...`
6. **Then**: Automatic redirect to `/dashboard`

### STEP 3: Check Console

Open browser DevTools (F12) → Console tab

You should see:
```
[AuthContext] Creating missing user_profiles entry for: [user-id]
[AuthContext] Creating missing user_roles entry for: [user-id]
```

**NO 404 errors should appear.**

---

## If Still Getting 404

### Check 1: Vercel Deployment
```
1. Go to https://vercel.com/niraiva-app/deployments
2. Look at latest deployment status
3. If it says "FAILED", click it to see error
4. If it says "BUILDING", wait for it to complete
5. If it says "READY", hard refresh browser (Ctrl+Shift+R)
```

### Check 2: Supabase Configuration
```
1. Go to https://supabase.com → Your Project → Authentication → URL Configuration
2. Verify "Site URL" = https://niraiva-app.vercel.app (no trailing slash)
3. Verify "Redirect URLs" includes:
   - https://niraiva-app.vercel.app/auth/callback
   - https://niraiva-app.vercel.app/login
   - https://niraiva-app.vercel.app/dashboard
```

### Check 3: Browser Network Tab
```
1. Open DevTools → Network tab
2. Click "Sign in with Google"
3. Look for request to /auth/callback
4. What status code? 
   - 404 = Vercel not rewriting (try Redeploy step)
   - 200 = Working! (try F5 refresh if page doesn't redirect)
```

---

## Code Changes Deployed

- `aad64d4` - Improved Vercel routing
- `60fe466` - Auto-init on signIn
- `a7a8cfb` - Auto-init on auth change
- `34d5a10` - Root vercel.json
- `ae47683` - Null safety

All code is ready. Just need Vercel to recognize the config.

---

## Exact Steps to Redeploy (Most Important)

⚠️ **DO THIS EXACTLY:**

1. Open https://vercel.com/niraiva-app
2. Click **Deployments** (top tab)
3. Find the latest (top) deployment
4. Click the **3-dot menu** on it
5. Click **Redeploy**
6. Click **Redeploy** in the confirmation dialog
7. **WAIT 2-3 minutes** for "Ready" status
8. Once "Ready", test in browser

---

## Expected Result After Fix

| Test | Before | After |
|------|--------|-------|
| Google login | 404 on /auth/callback ❌ | Redirects to /dashboard ✅ |
| Email login | Silent redirect to landing ❌ | Redirects to /dashboard ✅ |
| API calls | 404 from backend ❌ | Reports load ✅ |
| Console | Multiple errors ❌ | Clean, no 404s ✅ |

---

## If Redeploy Doesn't Work

Try this nuclear option:
1. Go to Vercel Settings
2. Find **Environment Variables** section  
3. Add a dummy variable like `REBUILD_TRIGGER=timestamp`
4. This forces a full rebuild
5. Redeploy

Then test again.
