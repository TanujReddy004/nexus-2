# NEXUS — Cross Platform Productivity Command Center

## Run
```bash
npm install
npm run dev
```

## Real Authentication Setup

NEXUS now uses Supabase Authentication instead of fake/demo credentials.

1. Create a Supabase project.
2. Enable Email/Password authentication.
3. Enable Confirm Email.
4. Copy `.env.local.example` to `.env.local`.
5. Add your project URL and anon key.
6. Run `npm install`.
7. Run `npm run dev`.

Users can only successfully access protected pages after a real authenticated Supabase session exists.

## Current app
- Corrected login input icon alignment
- Real Supabase email/password authentication
- Protected routes using authenticated session
- Responsive desktop/mobile navigation
- Notification center
- Dashboard
- Projects UI
- Functional focus timer
- Analytics charts

## Next implementation
- Signup page with email verification
- Verification confirmation screen
- Forgot password flow
- Google/Apple OAuth
- Database-backed projects/tasks
- Real notification persistence
- Capacitor native Android/iOS integration
