// Strangers Connect signaling on Cloudflare Workers + Durable Objects.
//
// Privacy model
// - This server only introduces two browsers. Video, audio and chat are end-to-end
//   encrypted between them; the server relays opaque blobs it cannot read.
// - No messages, no recordings, no IP addresses are stored or logged.
// - The only things persisted are one-way salted hashes: bans, and "do not match
//   us again" pairs. Both expire automatically.

import { DurableObject } from 'cloudflare:workers'

export interface Env {
    LOBBY: DurableObjectNamespace<Lobby>
    HASH_SALT: string // secret: `wrangler secret put HASH_SALT`
    // Cloudflare Realtime TURN key (dashboard > Realtime > TURN). Optional: without it,
    // calls still work on most networks, just not through strict firewalls.
    TURN_KEY_ID?: string
    TURN_KEY_API_TOKEN?: string
    ALLOWED_ORIGINS?: string // comma separated, optional override
}

const DEFAULT_ORIGINS = [
    'https://www.strangersconnect.com',
    'https://strangersconnect.com',
    'https://strangers-connect.vercel.app',
    'http://localhost:3000',
]

const BAN_THRESHOLD = 5 // unique reporters
const BAN_TTL_MS = 30 * 24 * 3600 * 1000
// Mobile carriers share one IP across thousands of people, so network bans stay short
const NET_BAN_TTL_MS = 24 * 3600 * 1000
const AVOID_TTL_MS = 180 * 24 * 3600 * 1000
const MAX_FRAME_BYTES = 64 * 1024
const MAX_CHAT_CHARS = 8000
const MAX_SOCKETS_PER_NETWORK = 12
const RECENT_PEERS = 5 // attachments are capped at 2 KB

async function sha256(input: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

function originAllowed(origin: string | null, env: Env): boolean {
    if (!origin) return false
    const list = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : DEFAULT_ORIGINS
    return list.includes(origin) || /^https:\/\/strangers-connect-[a-z0-9-]+\.vercel\.app$/.test(origin)
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)
        if (url.pathname === '/health') return new Response('ok')
        if (url.pathname !== '/ws') return new Response('Not found', { status: 404 })
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 })
        // Browsers always send Origin on WebSocket upgrades; this stops other sites from using the server
        if (!originAllowed(request.headers.get('Origin'), env)) return new Response('Forbidden', { status: 403 })
        if (!env.HASH_SALT) return new Response('Server not configured', { status: 500 })

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
        const netHash = await sha256(`net:${env.HASH_SALT}:${ip}`)

        // One lobby object does the matching. It comfortably handles thousands of
        // concurrent users; shard by region later if it ever becomes a bottleneck.
        const stub = env.LOBBY.get(env.LOBBY.idFromName('lobby'))
        const headers = new Headers(request.headers)
        headers.set('X-Net-Hash', netHash)
        return stub.fetch(new Request(request.url, { headers, method: 'GET' }))
    },
} satisfies ExportedHandler<Env>

// Per-socket state, kept in the socket attachment so it survives hibernation
interface Attachment {
    userId: string | null
    deviceHash: string | null
    netHash: string
    matchedWith: string | null
    recentPeers: Peer[] // recent matches, newest first, so reports work after they leave
    waitingSince: number | null
}

interface Peer {
    id: string
    dev: string | null
    net: string
    skipUntil?: number // set when you press Next on them: not matched again for a while
}

type Inbound = { t: string; d?: any }

export class Lobby extends DurableObject<Env> {
    private sql: SqlStorage
    private buckets = new Map<WebSocket, { tokens: number; last: number }>()
    // In-memory indexes. Lost when the object hibernates, so the constructor rebuilds them
    // from the socket attachments, which do survive.
    private userIndex = new Map<string, WebSocket>()
    private waiting = new Set<WebSocket>()
    private turnCache: { servers: unknown[]; at: number } | null = null

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env)
        this.sql = ctx.storage.sql
        this.sql.exec(`CREATE TABLE IF NOT EXISTS bans (hash TEXT PRIMARY KEY, until INTEGER NOT NULL)`)
        this.sql.exec(`CREATE TABLE IF NOT EXISTS avoid (pair TEXT PRIMARY KEY, until INTEGER NOT NULL)`)
        this.sql.exec(`CREATE TABLE IF NOT EXISTS reports (target TEXT NOT NULL, reporter TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (target, reporter))`)

        for (const ws of ctx.getWebSockets()) {
            const a = ws.deserializeAttachment() as Attachment | null
            if (!a?.userId) continue
            this.userIndex.set(a.userId, ws)
            if (a.waitingSince !== null && !a.matchedWith) this.waiting.add(ws)
        }

        ctx.blockConcurrencyWhile(async () => {
            if (!(await ctx.storage.getAlarm())) await ctx.storage.setAlarm(Date.now() + 24 * 3600 * 1000)
        })
    }

    async fetch(request: Request): Promise<Response> {
        const netHash = request.headers.get('X-Net-Hash') || 'unknown'
        if (this.isBanned(netHash)) return new Response('Banned', { status: 403 })
        if (this.ctx.getWebSockets(`net:${netHash}`).length >= MAX_SOCKETS_PER_NETWORK) {
            return new Response('Too many connections', { status: 429 })
        }

        const { 0: client, 1: server } = new WebSocketPair()
        this.ctx.acceptWebSocket(server, [`net:${netHash}`])
        const att: Attachment = { userId: null, deviceHash: null, netHash, matchedWith: null, recentPeers: [], waitingSince: null }
        server.serializeAttachment(att)
        return new Response(null, { status: 101, webSocket: client })
    }

    // ---------- helpers ----------

    private att(ws: WebSocket): Attachment {
        return ws.deserializeAttachment() as Attachment
    }

    private save(ws: WebSocket, att: Attachment) {
        ws.serializeAttachment(att)
    }

    private byUser(userId: string): WebSocket | undefined {
        const ws = this.userIndex.get(userId)
        if (!ws) return undefined
        if (ws.readyState !== 1 || this.att(ws).userId !== userId) {
            this.userIndex.delete(userId)
            return undefined
        }
        return ws
    }

    private send(ws: WebSocket | undefined, t: string, d: unknown) {
        try {
            ws?.send(JSON.stringify({ t, d }))
        } catch {
            // socket already closed
        }
    }

    private allow(ws: WebSocket, cost = 1): boolean {
        // Token bucket: bursts of 120, refills 30 per second. Plenty for ICE, stops floods.
        const now = Date.now()
        const b = this.buckets.get(ws) ?? { tokens: 120, last: now }
        b.tokens = Math.min(120, b.tokens + ((now - b.last) / 1000) * 30)
        b.last = now
        this.buckets.set(ws, b)
        if (b.tokens < cost) return false
        b.tokens -= cost
        return true
    }

    private isBanned(...hashes: (string | null)[]): boolean {
        const now = Date.now()
        for (const h of hashes) {
            if (!h) continue
            const row = this.sql.exec(`SELECT until FROM bans WHERE hash = ?`, h).toArray()[0]
            if (row && (row.until as number) > now) return true
        }
        return false
    }

    private pairKey(a: string, b: string) {
        return a < b ? `${a}|${b}` : `${b}|${a}`
    }

    private avoided(a: string | null, b: string | null): boolean {
        if (!a || !b) return false
        const row = this.sql.exec(`SELECT until FROM avoid WHERE pair = ?`, this.pairKey(a, b)).toArray()[0]
        return !!row && (row.until as number) > Date.now()
    }

    private addAvoid(a: string | null, b: string | null) {
        if (!a || !b) return
        this.sql.exec(`INSERT OR REPLACE INTO avoid (pair, until) VALUES (?, ?)`, this.pairKey(a, b), Date.now() + AVOID_TTL_MS)
    }

    private remember(me: Attachment, other: Attachment) {
        const entry: Peer = { id: other.userId!, dev: other.deviceHash, net: other.netHash }
        me.recentPeers = [entry, ...me.recentPeers.filter((p) => p.id !== entry.id)].slice(0, RECENT_PEERS)
    }

    // The peer this socket is matched with, or undefined. All relays go through this.
    private peerOf(ws: WebSocket, to: unknown): WebSocket | undefined {
        const me = this.att(ws)
        if (!me.matchedWith || me.matchedWith !== to) return undefined
        const peer = this.byUser(me.matchedWith)
        if (!peer || this.att(peer).matchedWith !== me.userId) return undefined
        return peer
    }

    private unmatch(ws: WebSocket, notifyPeer = true) {
        const me = this.att(ws)
        if (!me.matchedWith) return
        const peer = this.byUser(me.matchedWith)
        me.matchedWith = null
        this.save(ws, me)
        if (peer) {
            const p = this.att(peer)
            if (p.matchedWith === me.userId) {
                p.matchedWith = null
                this.save(peer, p)
                if (notifyPeer) this.send(peer, 'disconnected', {})
            }
        }
    }

    // Short-lived relay credentials, shared by everyone and refreshed every two hours.
    // Only handed to sockets that have just been matched, so they cannot be scraped freely.
    private async iceServers(): Promise<unknown[]> {
        const { TURN_KEY_ID, TURN_KEY_API_TOKEN } = this.env
        if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) return []
        if (this.turnCache && Date.now() - this.turnCache.at < 2 * 3600 * 1000) return this.turnCache.servers
        try {
            const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ttl: 6 * 3600 }),
            })
            if (!res.ok) throw new Error(`TURN ${res.status}`)
            const body = (await res.json()) as { iceServers?: unknown }
            const list = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : []
            this.turnCache = { servers: list, at: Date.now() }
            return list
        } catch (error) {
            console.error('turn credentials unavailable', String(error))
            return this.turnCache?.servers ?? []
        }
    }

    private async tryMatch(ws: WebSocket) {
        const me = this.att(ws)
        // The Set keeps insertion order, so this walks the queue oldest first
        const waiting = [...this.waiting]
            .filter((s) => s !== ws && s.readyState === 1)
            .map((s) => ({ s, a: this.att(s) }))
            .filter(({ a }) => a.waitingSince !== null && !a.matchedWith && a.userId)

        const now = Date.now()
        const recentOf = (x: Attachment, id: string | null) => x.recentPeers.find((p) => p.id === id)
        const skipped = (a: Attachment) =>
            (recentOf(me, a.userId)?.skipUntil ?? 0) > now || (recentOf(a, me.userId)?.skipUntil ?? 0) > now
        const allowed = (a: Attachment) =>
            !(a.deviceHash && a.deviceHash === me.deviceHash) && !this.avoided(me.deviceHash, a.deviceHash) && !skipped(a)
        // New faces first; someone you met recently only if nobody else is waiting.
        // "No, never" (avoid) and a recent Next (skip) always keep two people apart.
        const fresh = waiting.filter(({ a }) => allowed(a) && !recentOf(me, a.userId) && !recentOf(a, me.userId))
        const familiar = waiting.filter(({ a }) => allowed(a) && (recentOf(me, a.userId) || recentOf(a, me.userId)))
        for (const { s, a } of [...fresh, ...familiar]) {

            me.matchedWith = a.userId
            a.matchedWith = me.userId
            me.waitingSince = a.waitingSince = null
            this.remember(me, a)
            this.remember(a, me)
            this.save(ws, me)
            this.save(s, a)
            this.waiting.delete(ws)
            this.waiting.delete(s)
            const iceServers = await this.iceServers()
            this.send(ws, 'matched', { strangerId: a.userId, iceServers })
            this.send(s, 'matched', { strangerId: me.userId, iceServers })
            return
        }

        me.waitingSince = Date.now()
        this.save(ws, me)
        this.waiting.add(ws)
        // Let the person know how busy it is (counts only, nothing about who)
        this.send(ws, 'queue', { online: this.userIndex.size, searching: this.waiting.size })
    }

    private fileReport(ws: WebSocket, targetId: unknown) {
        const me = this.att(ws)
        const target = me.recentPeers.find((p) => p.id === targetId)
        if (!target?.dev) return

        // Reports are counted per reporting network, so one person cannot ban someone alone
        this.sql.exec(`INSERT OR IGNORE INTO reports (target, reporter, at) VALUES (?, ?, ?)`, target.dev, me.netHash, Date.now())
        this.addAvoid(me.deviceHash, target.dev)
        const count = this.sql.exec(`SELECT COUNT(*) AS n FROM reports WHERE target = ?`, target.dev).one().n as number

        if (count >= BAN_THRESHOLD) {
            const until = Date.now() + BAN_TTL_MS
            this.sql.exec(`INSERT OR REPLACE INTO bans (hash, until) VALUES (?, ?)`, target.dev, until)
            this.sql.exec(`INSERT OR REPLACE INTO bans (hash, until) VALUES (?, ?)`, target.net, Date.now() + NET_BAN_TTL_MS)
            this.sql.exec(`DELETE FROM reports WHERE target = ?`, target.dev)
            const targetWs = this.byUser(target.id)
            if (targetWs) {
                this.unmatch(targetWs)
                this.send(targetWs, 'banned', { reason: 'You have been banned after multiple reports of inappropriate behavior.' })
                targetWs.close(4003, 'banned')
            }
        }
        this.send(ws, 'report-confirmed', { message: 'Report sent. You will not be matched with them again.' })
    }

    // ---------- WebSocket events ----------

    async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
        if (typeof raw !== 'string' || raw.length > MAX_FRAME_BYTES) return ws.close(1009, 'too large')
        if (!this.allow(ws)) return

        let msg: Inbound
        try {
            msg = JSON.parse(raw)
        } catch {
            return
        }
        if (!msg || typeof msg.t !== 'string') return
        const d = msg.d ?? {}
        const me = this.att(ws)

        // Nothing but register is accepted before a socket identifies itself
        if (msg.t !== 'register' && !me.userId) return

        switch (msg.t) {
            case 'register': {
                if (me.userId) return
                if (typeof d.userId !== 'string' || !/^[0-9a-f-]{36}$/.test(d.userId)) return
                if (typeof d.deviceId !== 'string' || !/^[0-9a-f]{32}$/.test(d.deviceId)) return
                if (this.byUser(d.userId)) return // ID already live elsewhere
                const deviceHash = await sha256(`dev:${this.env.HASH_SALT}:${d.deviceId}`)
                if (this.isBanned(deviceHash)) {
                    this.send(ws, 'banned', { reason: 'You have been banned after multiple reports of inappropriate behavior.' })
                    return ws.close(4003, 'banned')
                }
                me.userId = d.userId
                me.deviceHash = deviceHash
                this.save(ws, me)
                this.userIndex.set(d.userId, ws)
                return
            }
            case 'find-stranger': {
                if (me.matchedWith || me.waitingSince !== null) return
                if (!this.allow(ws, 10)) return
                return this.tryMatch(ws)
            }
            case 'cancel-search': {
                me.waitingSince = null
                this.waiting.delete(ws)
                return this.save(ws, me)
            }
            case 'webrtc-offer':
            case 'webrtc-answer':
            case 'webrtc-ice':
            case 'key-exchange': {
                const peer = this.peerOf(ws, d.to)
                if (!peer) return
                const out: Record<string, unknown> = { from: me.userId }
                if (msg.t === 'webrtc-offer') out.offer = d.offer
                if (msg.t === 'webrtc-answer') out.answer = d.answer
                if (msg.t === 'webrtc-ice') out.candidate = d.candidate
                if (msg.t === 'key-exchange') {
                    if (typeof d.publicKey !== 'string' || d.publicKey.length > 512) return
                    out.publicKey = d.publicKey
                }
                return this.send(peer, msg.t, out)
            }
            case 'send-message': {
                if (typeof d.text !== 'string' || d.text.length > MAX_CHAT_CHARS || d.encrypted !== true) return
                if (!this.allow(ws, 3)) return
                return this.send(this.peerOf(ws, d.to), 'message', { text: d.text, encrypted: true, from: me.userId })
            }
            case 'typing': {
                return this.send(this.peerOf(ws, d.to), 'typing', { from: me.userId, on: d.on === true })
            }
            case 'disconnect-stranger': {
                // Pressing Next means "not this person right now"
                if (d.skip === true && me.matchedWith) {
                    const entry = me.recentPeers.find((p) => p.id === me.matchedWith)
                    if (entry) {
                        entry.skipUntil = Date.now() + 2 * 60 * 1000
                        this.save(ws, me)
                    }
                }
                return this.unmatch(ws)
            }
            case 'report-user':
                return this.fileReport(ws, d.reportedUserId)
            case 'avoid': {
                // "Do not match me with this person again". Only allowed for someone you actually met.
                const peer = me.recentPeers.find((p) => p.id === d.peerId)
                if (peer) this.addAvoid(me.deviceHash, peer.dev)
                return this.send(ws, 'avoid-confirmed', {})
            }
        }
    }

    async webSocketClose(ws: WebSocket) {
        this.cleanup(ws)
    }

    async webSocketError(ws: WebSocket) {
        this.cleanup(ws)
    }

    private cleanup(ws: WebSocket) {
        this.unmatch(ws)
        const me = this.att(ws)
        if (me.userId && this.userIndex.get(me.userId) === ws) this.userIndex.delete(me.userId)
        this.buckets.delete(ws)
        this.waiting.delete(ws)
        me.waitingSince = null
        this.save(ws, me)
    }

    // Daily housekeeping: drop expired bans, avoid pairs and stale reports
    async alarm() {
        const now = Date.now()
        this.sql.exec(`DELETE FROM bans WHERE until < ?`, now)
        this.sql.exec(`DELETE FROM avoid WHERE until < ?`, now)
        this.sql.exec(`DELETE FROM reports WHERE at < ?`, now - BAN_TTL_MS)
        await this.ctx.storage.setAlarm(now + 24 * 3600 * 1000)
    }
}
