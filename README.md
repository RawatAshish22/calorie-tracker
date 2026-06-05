# Sistum Tracker

Mobile-first calorie tracking app with an animated brand intro, local login/register flow, guided profile setup, quick food cards, daily goals, history, and configurable AI nutrition lookup.

## Run

```bash
npm install
npm run dev
```

Backend AI proxy:

```bash
npm run backend
```

Local app URL:

```text
http://127.0.0.1:5173/
```

## Use On Mobile

For testing on a phone connected to the same Wi-Fi as your computer:

```bash
npm run backend
npm run dev:mobile
```

Find your computer LAN IP address, then open this on the phone:

```text
http://YOUR_COMPUTER_IP:5173/
```

Examples:

```text
http://192.168.1.25:5173/
http://10.0.0.8:5173/
```

The Vite dev server will proxy `/api` to the backend running on your computer.

To install it like an app:

- Android Chrome: open the URL, tap the browser menu, then tap `Add to Home screen` or `Install app`.
- iPhone Safari: open the URL, tap Share, then tap `Add to Home Screen`.

Camera scanning and install prompts work best from an HTTPS URL. For full mobile-app behavior, deploy the built app to an HTTPS host and run the backend on an HTTPS-capable server. Plain LAN HTTP is fine for testing screens and logging, but mobile browsers may block camera access outside secure contexts.

## AI Providers

The app only calls user-configured free-tier capable providers:

- Google Gemini
- Cloudflare Workers AI
- OpenRouter free model IDs
- Offline estimates when no key is set or an AI call fails

Set provider keys in `backend/.env`. The frontend only sends provider preference and user requests to the backend proxy.

Credit-saving behavior:

- Quick-list foods are answered locally before AI is called.
- Backend responses are cached.
- Camera scanning compresses frames and scans every few seconds instead of continuously.
- AI Coaching only calls the backend when the user sends a message.

Vision scanning needs Gemini or a vision-capable OpenRouter model configured in `backend/.env`.

## Brand

The app name is `Sistum Tracker : Calorie Tracking App`.

The logo lives at:

```text
public/sistum-logo.svg
```
