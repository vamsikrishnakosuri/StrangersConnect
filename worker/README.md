# Signaling server (Cloudflare Workers + Durable Objects)

Introduces two browsers so they can open a direct, encrypted WebRTC call. It never
sees video, audio or chat text, stores no messages and logs no IP addresses.

## Deploy (free plan)

```bash
cd worker
npm install
npx wrangler login                 # opens the browser, you sign in yourself
npx wrangler secret put HASH_SALT  # paste a long random string, keep it secret
npx wrangler deploy
```

The deploy prints a URL like `https://strangers-connect-signal.<you>.workers.dev`.
In Vercel, set:

```
NEXT_PUBLIC_SIGNAL_URL = wss://strangers-connect-signal.<you>.workers.dev/ws
```

then redeploy the site. Check `https://strangers-connect-signal.<you>.workers.dev/health` returns `ok`.

## Local development

```bash
npx wrangler dev --port 8787 --persist-to <short path>
```

On Windows, use a short `--persist-to` path; deep folders hit the 260 character limit.
Local secrets live in `.dev.vars` (`HASH_SALT=anything`), which is git-ignored.

## What is stored

Only salted one-way hashes, in the Durable Object's SQLite:

| Table   | Contents                                    | Expires  |
|---------|---------------------------------------------|----------|
| bans    | hash of a banned device or network          | 30 days (network: 24 h) |
| avoid   | pair of device hashes that chose "No, never" | 180 days |
| reports | device hash + reporter network hash          | 30 days  |
