# Turnstile setup for Sparky's Space

This guide is for the repository owner. Do not paste secret keys into GitHub, website files, screenshots, or chat.

## 1. Create a Cloudflare Turnstile widget

1. Open the Cloudflare dashboard and go to **Turnstile**.
2. Create a widget for the hostname `anonymf0y2g.github.io` (the free GitHub Pages hostname).
3. Choose **Managed** mode.
4. Copy the **Site Key** and **Secret Key** separately.

The Site Key is public and belongs in the browser configuration. The Secret Key is private.

## 2. Add the public Site Key

Edit `assets/config.js` and replace only:

```js
turnstileSiteKey: "REPLACE_WITH_CLOUDFLARE_SITE_KEY"
```

with the Site Key from Cloudflare. Do not put the Secret Key in this file.

## 3. Enable CAPTCHA for Supabase Auth

In the Supabase dashboard for this project:

1. Open **Authentication** → **Bot and Abuse Protection** (the exact placement may vary as the dashboard changes).
2. Enable CAPTCHA protection.
3. Choose **Cloudflare Turnstile**.
4. Paste the Cloudflare **Secret Key** into the CAPTCHA provider settings and save.

The website passes the short-lived widget token to Supabase for sign-up and sign-in. Supabase validates it using the secret stored in its Auth settings.

## 4. Set the Edge Function secret

In the Supabase dashboard, open **Edge Functions** → **Secrets** and add:

- Name: `CLOUDFLARE_TURNSTILE_SECRET`
- Value: the Cloudflare **Secret Key**

Do not add a Supabase service-role key. The function uses the visitor's authenticated session and the project's publishable/anon key, so database Row Level Security remains in force.

## 5. Deploy the Edge Function

Deploy `supabase/functions/submit-community-action/index.ts` as the function named `submit-community-action`.

Keep JWT verification enabled for this function. It must require a signed-in Supabase user. The function also checks the user's session itself, verifies the Turnstile token with Cloudflare Siteverify, checks the expected hostname and action, and then inserts the report or appeal using the authenticated user's database permissions.

## 6. Verify the setup

After the website changes are merged and the function is deployed:

- Sign-up and sign-in should show the Turnstile widget on the Account page.
- Report submission and appeal submission should show the shared Turnstile widget on Safety & Reports.
- If the key or secret is missing, the forms intentionally remain blocked rather than silently accepting unverified submissions.
- Test with a disposable account and a harmless test report. Do not use a real member as a test target.

## Official documentation

- Supabase CAPTCHA for Auth: https://supabase.com/docs/guides/auth/auth-captcha
- Supabase Turnstile with Edge Functions: https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile
- Cloudflare Turnstile setup: https://developers.cloudflare.com/turnstile/get-started/
- Cloudflare server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
