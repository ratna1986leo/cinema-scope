# Cinema Scope — TMDB proxy for Render + Blogger

This folder is a small Node.js service. Deploy **this folder as the Render Web Service root directory**, not the repository root.

## Create a Render Web Service

1. Push this repository to GitHub (the files in this folder should be on `main`).
2. In Render, choose **New + → Web Service**, then connect repository `ratna1986leo/cinema-scope`.
3. Set **Root Directory** to `render-tmdb-proxy`.
4. Set **Runtime** to Node.
5. Set **Build Command** to `npm install`.
6. Set **Start Command** to `npm start`.
7. Add Environment Variables:
   - `TMDB_API_KEY`: your valid TMDB API key (keep it private).
   - `BLOGGER_ORIGINS`: exact Blogger origin, e.g. `https://yourblog.blogspot.com`. For a custom domain, use its real origin, e.g. `https://www.example.com`. Multiple origins may be comma-separated.
8. Create the Web Service and wait until its status is Live.

## Check that it works

Open the service URL shown by Render in a browser. It should return JSON with `"ok": true`.

Then try this endpoint (replace the hostname with your real service URL):
`https://YOUR-SERVICE.onrender.com/api/tmdb?path=%2F3%2Ftrending%2Fall%2Fweek&language=id-ID`

A valid TMDB response should contain a `results` array. An error mentioning `TMDB_API_KEY` means that secret needs to be added in Render. A 403 response from a browser usually means the blog's exact origin is missing from `BLOGGER_ORIGINS`.

## Blogger setting

In the Blogger JavaScript, set:
```js
const TMDB_PROXY_BASE = 'https://YOUR-SERVICE.onrender.com/api/tmdb';
```
Replace the example URL with your actual service URL. Keep the path `/api/tmdb`.

Do not put the TMDB key in Blogger HTML. When `TMDB_PROXY_BASE` is set, the client code uses the Render proxy first and does not use its direct-TMDB fallback.

## Notes

- Free web services can sleep after inactivity, which may make the first request slow while the service wakes up.
- CORS is a browser policy, not authentication. This service only permits configured browser origins, but anyone who discovers the public endpoint can still attempt non-browser requests. Keep the code's endpoint allowlist and monitor usage.
