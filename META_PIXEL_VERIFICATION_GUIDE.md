# Meta Pixel Verification Guide

This guide explains how to verify the Meta Pixel fixes in production and test environments.

## Quick Summary of Fixes

✅ **CompleteRegistration event** now fires when users complete signup  
✅ **Domain filtering** ensures Meta Pixel only loads on `oraculocultural.com.br`  
✅ **Purchase events** automatically inherit domain filtering  
✅ **Localhost/white-label** domains no longer send events (stub function prevents errors)

---

## 1. Test CompleteRegistration Event (Real-time)

### Prerequisites
- Meta Events Manager access for Pixel ID `642831091634391`
- Access to production site: `https://oraculocultural.com.br`
- Browser DevTools (Chrome/Edge recommended)

### Steps

1. **Open Meta Events Manager Test Events**
   - Go to: https://business.facebook.com/events_manager2/list/pixel/642831091634391/test_events
   - Keep this tab open

2. **Open Production Site in New Tab**
   - Navigate to: `https://oraculocultural.com.br/cadastro`
   - Open DevTools (F12) → Console tab

3. **Test Email/Password Signup**
   ```
   a) Click "Criar conta" (if in login mode)
   b) Fill email: test+[timestamp]@example.com
   c) Create strong password (min 8 chars, upper, lower, number, special char)
   d) Check terms checkbox
   e) Click "Criar conta"
   f) Fill "Nome completo" (e.g., "Test User Oct29")
   g) Fill "Empresa" (optional, e.g., "Test Company")
   h) Click "Finalizar cadastro"
   i) Watch "Conta criada com sucesso!" screen appear
   ```

4. **Verify in DevTools Console**
   - Look for: `[Meta Pixel] Evento CompleteRegistration disparado: { registration_method: 'email' }`
   - If missing, check for error messages

5. **Verify in Meta Test Events**
   - Switch to Meta Events Manager tab
   - Should show **CompleteRegistration** event immediately (< 5 seconds)
   - Event details should include:
     - `content_name: "Cadastro Oráculo Cultural"`
     - `status: "completed"`
   - Browser info should show source URL: `oraculocultural.com.br/cadastro`

6. **Test Google OAuth Signup** (optional, requires Google account)
   ```
   a) Logout from previous test account
   b) Go back to /cadastro
   c) Click "Continuar com Google"
   d) Select Google account
   e) If account is new: fill name + company → "Finalizar cadastro"
   f) Watch for CompleteRegistration event in console + Meta
   ```

---

## 2. Verify Domain Filtering (Negative Test)

### Test on Localhost

1. **Start Local Development Server**
   ```bash
   npm run dev
   ```

2. **Open Localhost in Browser**
   - Navigate to: `http://localhost:5173` (or your dev port)
   - Open DevTools → Console

3. **Verify Pixel is Disabled**
   - Should see: `[Meta Pixel] Disabled on non-production domain: localhost`
   - Navigate through the site (click pages, forms, etc.)
   - All `fbq()` calls should log to console but NOT send to Meta
   - Example: `[Meta Pixel] Disabled on localhost - Event: ["track", "PageView"]`

4. **Verify in Meta Events Manager**
   - Check Overview: https://business.facebook.com/events_manager2/list/pixel/642831091634391/overview
   - Filter: Last 1 hour
   - Should see **no events** from `localhost` after the fix deployment

### Test on Firebase Preview Domains

If you have access to Firebase preview channels (e.g., `culturalapp-fb9b0.web.app`):

1. Open preview URL in browser
2. Open DevTools → Console
3. Verify similar disabled message (if domain is not `oraculocultural.com.br`)
4. Events should not reach Meta

---

## 3. Verify Production Events (Post-Deployment)

### Wait Period
- Allow 15-60 minutes after deployment for event aggregation

### Check Meta Events Manager Overview

1. **Go to Overview**
   - URL: https://business.facebook.com/events_manager2/list/pixel/642831091634391/overview

2. **Filter by Time**
   - Select: "Last 24 hours" or "Last 7 days"

3. **Verify Event Counts**
   - **CompleteRegistration**: Should start appearing (previously 0)
   - **PageView**: Should show normal traffic, but sources should be clean
   - **Lead**: Should continue working (newsletter signups)
   - **Purchase**: Should continue working (premium subscriptions, guia especial)

4. **Check Event Sources**
   - Click on any event type
   - Click "View Details" or "Event Source URLs"
   - All events should be from: `oraculocultural.com.br/*`
   - **Should NOT see**:
     - `localhost:*`
     - `oraculo-emaklabin.web.app`
     - `oraculo-is.web.app`
     - `criador-is.web.app`
     - `execucaofinanceira.web.app`
     - `culturalapp-fb9b0.web.app` (unless you want this)
     - `captarrecursos.lovable.app`

---

## 4. Verify Purchase Events Still Work

### Test Premium Subscription Purchase

1. Login to production site: `https://oraculocultural.com.br`
2. Navigate to: `/cadastro-premium`
3. Select a plan (e.g., "Básico")
4. Complete Stripe checkout with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
5. After redirect to success page, verify:
   - DevTools console shows: `[Meta Pixel] Evento Purchase disparado`
   - Meta Test Events shows **Purchase** event with value and currency

### Test Guia Especial Purchase

1. Navigate to: `/inteligencia-mercado`
2. Click on any "Guia Especial"
3. Click "Baixe agora" or final CTA button
4. Complete Stripe checkout (same test card as above)
5. After redirect, verify Purchase event in console + Meta

---

## 5. Debugging Tips

### If CompleteRegistration Doesn't Fire

1. **Check DevTools Console for Errors**
   - Look for: `[Meta Pixel] Erro ao disparar CompleteRegistration: ...`
   - JavaScript errors in analytics.ts or Cadastro.tsx

2. **Verify Pixel Loaded**
   - Console should show: `[Meta Pixel] Loaded on production domain`
   - If not, check hostname: `console.log(window.location.hostname)`

3. **Check Registration Flow**
   - Ensure you complete ALL steps (extra info form)
   - "Conta criada com sucesso!" screen must appear
   - Check for: `[Analytics] complete_registration` event (goes to Firebase/GTM/Mixpanel)

### If Domain Filtering Doesn't Work

1. **Check Browser Cache**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or clear cache and reload

2. **Verify Deployment**
   - Ensure latest code is deployed to production
   - Check GitHub Actions: https://github.com/marcosferreiradeoliveira/oraculo-fluxo-inicial/actions
   - Confirm deployment succeeded

3. **Check index.html Source**
   - View page source in browser
   - Search for: `if (window.location.hostname === 'oraculocultural.com.br')`
   - If not found, redeploy or check Firebase hosting cache

### If Events Still Come from Localhost

1. **Check Meta Events Manager Source Filter**
   - Filter by: "Event Source URL" contains "localhost"
   - Check timestamp - events might be from before the fix

2. **Clear Local Storage**
   - DevTools → Application → Local Storage → Delete all
   - Cookies → Delete all for localhost
   - Restart browser

---

## 6. Expected Metrics (Post-Fix)

### Baseline (Before Fix)
- **CompleteRegistration**: 0 events
- **PageView**: Mixed sources (localhost + production + white-label)
- **Lead**: Working
- **Purchase**: Working

### After Fix
- **CompleteRegistration**: 1-10+ events/day (depends on signup volume)
- **PageView**: Clean source (only `oraculocultural.com.br`)
- **Lead**: Working (unchanged)
- **Purchase**: Working (unchanged, cleaner source)

### Event Ratios (Approximate)
- **PageView** to **CompleteRegistration**: ~100:1 to 500:1
- **CompleteRegistration** to **Purchase**: ~10:1 to 50:1
- Ratios vary by traffic source and conversion funnel

---

## 7. Conversions API (Future Enhancement)

The current implementation uses **client-side tracking only**. For more reliable event tracking, consider adding **server-side tracking** via Meta Conversions API:

### Benefits
- Not blocked by ad blockers or browser privacy settings
- More reliable event delivery
- Better attribution for iOS 14.5+ (ATT)
- Deduplicated events (same event sent client + server, matched by `event_id`)

### Implementation Requirements
- Meta Conversions API Access Token (from Events Manager)
- Firebase Functions webhook handlers
- Event ID generation (UUIDv4) on client and server
- Event matching: `em` (hashed email), `ph` (hashed phone), `fn` (first name), etc.

### Example Events to Track Server-side
1. **CompleteRegistration**: When user document created in Firestore
2. **Purchase**: When Stripe webhook confirms payment
3. **Lead**: When email captured via newsletter form submission

**File to create**: `functions/src/meta-conversions-api.ts`

---

## 8. Contacts & Resources

- **Meta Events Manager**: https://business.facebook.com/events_manager2/list/pixel/642831091634391
- **Meta Pixel ID**: `642831091634391`
- **Dataset Name**: "Dados de Oraculo"
- **GA4 Property**: `G-51T1MVH3B1`
- **Mixpanel Project**: Present (token in index.html)

For further questions or issues, refer to:
- PR: https://github.com/marcosferreiradeoliveira/oraculo-fluxo-inicial/pull/1
- Codebase: https://github.com/marcosferreiradeoliveira/oraculo-fluxo-inicial
