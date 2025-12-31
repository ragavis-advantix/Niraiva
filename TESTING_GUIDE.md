# Niraiva Authentication Testing Guide

## Testing Email/Password Login Flow (Patient)

### Prerequisites
- Frontend dev server running: `npm run dev` in `frontend/` directory
- Backend running (localhost or Render)
- Supabase project accessible
- Browser dev console open (F12)

### Test Case: Email/Password Login

#### Setup
1. Open http://localhost:5173/login in browser
2. Open browser Dev Console (F12 → Console tab)
3. Clear console before starting

#### Test Steps
1. **Check initial state:**
   - Look for log: `[Login] 🔐 Component RENDERED`
   - Look for logs: `[AuthContext] 🚀 STARTUP: Checking existing session...`
   
2. **Enter credentials:**
   - Email: `testpatient@gmail.com`
   - Password: `[password for test account]`
   - Click "Sign In"

3. **Monitor console logs (should appear in order):**
   ```
   [Login] 🔑 handleSubmit START
   [Login] ↳ Calling signIn()...
   [AuthContext] 🔑 SIGN_IN STARTED for: testpatient@gmail.com
   [AuthContext] ↳ Calling supabase.auth.signInWithPassword()...
   [AuthContext] ✅ signInWithPassword SUCCESS
   [AuthContext] ↳ User: testpatient@gmail.com | ID: [uuid]
   [AuthContext] ↳ Session Token: [first 20 chars]...
   [AuthContext] ↳ Calling ensureUserInitialized()...
   [AuthContext] ✅ ensureUserInitialized completed
   [AuthContext] 🔑 SIGN_IN COMPLETE - user state will update via onAuthStateChange
   [Login] ✅ signIn() completed
   [AuthContext] 📡 onAuthStateChange EVENT: SIGNED_IN
   [ProtectedRoute] user: true | loading: false | path: /login
   [Login] ↳ Waiting for state to settle...
   [Login] ↳ Navigating to: /dashboard
   [Login] 🔄 Calling navigate()...
   [ProtectedRoute] user: true | loading: false | path: /dashboard
   [Login] ↳ navigate() called (page should change)
   [ProtectedRoute] ✅ User authenticated, showing children
   [Dashboard] 🎯 MOUNTED - User: testpatient@gmail.com | Session: true
   ```

4. **Expected outcome:**
   - Page redirects to `/dashboard`
   - Dashboard displays user data
   - All console logs appear in order as listed above

#### What Each Log Means

**[Login] 🔐 Component RENDERED**
- Login page has been rendered

**[AuthContext] 🔑 SIGN_IN STARTED**
- Email/password login request initiated

**[AuthContext] ✅ signInWithPassword SUCCESS**
- Supabase successfully authenticated user
- Session and user token created

**[AuthContext] ensureUserInitialized**
- Creating or verifying user_profiles and user_roles table entries
- Ensures manually created users have proper database entries

**[AuthContext] 📡 onAuthStateChange EVENT: SIGNED_IN**
- Supabase event listener fired with auth state change
- User state being updated in React

**[ProtectedRoute] user: true | loading: false**
- Route protection checking user authentication
- Shows user is authenticated and not loading

**[Login] Navigating to: /dashboard**
- React Router navigate() being called
- Browser will route to /dashboard

**[ProtectedRoute] ✅ User authenticated, showing children**
- Dashboard component is being rendered
- Route protection passed

**[Dashboard] 🎯 MOUNTED**
- Dashboard component successfully mounted
- Ready to display user data

### Troubleshooting

**Symptom: Stuck on login page**
- Check console for error messages
- Look for missing logs (find where flow stops)
- Check network tab for failed API calls

**Symptom: "No user, redirecting to /login" log appears after redirect**
- Session state may not be persisting
- Check localStorage for Supabase session
- Verify Supabase URL and ANON_KEY in .env

**Symptom: "Loading spinner shown" log appears repeatedly**
- AuthContext loading state stuck at true
- Check if onAuthStateChange is firing
- Verify Supabase session is being recognized

**Symptom: Dashboard loads but data is empty**
- Redirect is working ✅
- Check if API calls are failing
- Look in Network tab for API errors
- Check backend CORS settings

### Network Tab Debugging

1. Open DevTools → Network tab
2. Filter for "fetch" or API calls
3. Expected successful calls after login:
   - GET `/api/reports/user-latest-report`
   - GET `/api/reports/user-health-parameters`
   - Other data fetching calls

### Success Criteria
- ✅ Page redirects to /dashboard
- ✅ Console logs appear in expected order
- ✅ Dashboard displays user data
- ✅ No 404 or auth errors in console

---

## Testing Google OAuth Flow

Similar process but starting at:
1. Click "Sign in with Google" button
2. Expected redirect: Google login → `/auth/callback` → `/dashboard`
3. Look for `[AuthCallback]` logs during OAuth flow

---

## Quick Test Command

After making changes:
```bash
# In frontend directory
npm run dev

# Then visit http://localhost:5173/login
```

All console logs will help identify where the flow succeeds or fails.

---

## Key Files for Reference

- `frontend/src/contexts/AuthContext.tsx` - Main auth logic
- `frontend/src/pages/Login.tsx` - Patient login form
- `frontend/src/pages/Dashboard.tsx` - Patient dashboard (redirect target)
- `frontend/src/pages/AuthCallback.tsx` - OAuth callback handler
- `frontend/src/App.tsx` - Route definitions and ProtectedRoute component
