import { Server, Socket } from 'socket.io'
import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'

// Privacy model
// - This server only introduces two browsers. Video, audio and chat are end-to-end
//   encrypted between them; the server relays opaque blobs it cannot read.
// - Nothing is written to disk. All state lives in memory and is gone on restart.
// - IP addresses are never stored or logged. Bans keep only a salted hash.
// - Logs contain counts, never user IDs, IPs, or message content.

const httpServer = createServer((req, res) => {
  // Lightweight health check for Railway/Render
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const DEFAULT_ORIGINS = [
  'https://www.strangersconnect.com',
  'https://strangersconnect.com',
  'https://strangers-connect.vercel.app',
  'http://localhost:3000',
]
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : DEFAULT_ORIGINS

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      // Allow same-origin tools (no Origin header) and Vercel preview deployments
      if (!origin || ALLOWED_ORIGINS.includes(origin) || /^https:\/\/strangers-connect-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        cb(null, true)
      } else {
        cb(new Error('Origin not allowed'), false)
      }
    },
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 64 * 1024, // signaling payloads are small; refuse anything large
})

// Per-process random salt unless one is provided, so hashes cannot be reversed with a lookup table
const IP_SALT = process.env.IP_HASH_SALT || randomBytes(32).toString('hex')
const hashIp = (ip: string) => createHash('sha256').update(IP_SALT + ip).digest('hex')

function clientIp(socket: Socket): string {
  // Behind Railway/Render the socket address is the proxy, so prefer the forwarded client address
  const fwd = socket.handshake.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  return first || socket.handshake.address || 'unknown'
}

interface User {
  id: string
  socketId: string
  matchedWith: string | null
  lastMatchedWith: string | null
  ipHash: string
}

const users = new Map<string, User>()
const socketToUser = new Map<string, string>()
const waitingQueue: string[] = []
const reportsAgainst = new Map<string, Set<string>>() // reported userId -> unique reporter ipHashes
const bannedUsers = new Set<string>()
const bannedIpHashes = new Set<string>()

const BAN_THRESHOLD = 5 // unique reporters
const MAX_MESSAGE_CHARS = 8000 // ciphertext is base64, roughly 1.4x the plaintext
const BAN_REASON = 'You have been banned after multiple reports of inappropriate behavior.'

// Simple token bucket per socket to stop floods
function rateLimiter(capacity: number, refillPerSec: number) {
  let tokens = capacity
  let last = Date.now()
  return () => {
    const now = Date.now()
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSec)
    last = now
    if (tokens < 1) return false
    tokens -= 1
    return true
  }
}

io.on('connection', (socket) => {
  const ipHash = hashIp(clientIp(socket))

  if (bannedIpHashes.has(ipHash)) {
    socket.emit('banned', { reason: BAN_REASON })
    socket.disconnect()
    return
  }

  const allowMessage = rateLimiter(20, 2)
  const allowSignal = rateLimiter(200, 50)
  const allowSearch = rateLimiter(10, 1)

  const me = () => {
    const id = socketToUser.get(socket.id)
    const user = id ? users.get(id) : undefined
    // A stale socket from before a reconnect must not act for the new one
    return user && user.socketId === socket.id ? user : undefined
  }

  // Only relay to the peer this socket is actually matched with
  const peerOf = (to: string) => {
    const user = me()
    if (!user || user.matchedWith !== to) return undefined
    return users.get(to)
  }

  socket.on('register', (userId: string) => {
    if (typeof userId !== 'string' || userId.length > 64) return
    if (bannedUsers.has(userId)) {
      socket.emit('banned', { reason: BAN_REASON })
      socket.disconnect()
      return
    }
    // Do not let a second socket hijack an ID that is already live
    const existing = users.get(userId)
    if (existing && existing.socketId !== socket.id && io.sockets.sockets.has(existing.socketId)) return

    users.set(userId, { id: userId, socketId: socket.id, matchedWith: null, lastMatchedWith: null, ipHash })
    socketToUser.set(socket.id, userId)
  })

  socket.on('find-stranger', () => {
    if (!allowSearch()) return
    const user = me()
    if (!user || user.matchedWith || bannedUsers.has(user.id)) return
    if (waitingQueue.includes(user.id)) return

    while (waitingQueue.length > 0) {
      const strangerId = waitingQueue.shift()!
      const stranger = users.get(strangerId)
      if (stranger && !stranger.matchedWith && strangerId !== user.id) {
        user.matchedWith = strangerId
        stranger.matchedWith = user.id
        user.lastMatchedWith = strangerId
        stranger.lastMatchedWith = user.id
        io.to(user.socketId).emit('matched', { strangerId })
        io.to(stranger.socketId).emit('matched', { strangerId: user.id })
        return
      }
    }
    waitingQueue.push(user.id)
  })

  // WebRTC signaling. Both browsers fold the DTLS fingerprints from this SDP into
  // the on-screen safety code, so tampering here would show up as mismatched codes.
  socket.on('webrtc-offer', (data: { offer: unknown; to: string }) => {
    const peer = allowSignal() && peerOf(data?.to)
    if (peer) io.to(peer.socketId).emit('webrtc-offer', { offer: data.offer, from: me()!.id })
  })

  socket.on('webrtc-answer', (data: { answer: unknown; to: string }) => {
    const peer = allowSignal() && peerOf(data?.to)
    if (peer) io.to(peer.socketId).emit('webrtc-answer', { answer: data.answer, from: me()!.id })
  })

  socket.on('webrtc-ice', (data: { candidate: unknown; to: string }) => {
    const peer = allowSignal() && peerOf(data?.to)
    if (peer) io.to(peer.socketId).emit('webrtc-ice', { candidate: data.candidate, from: me()!.id })
  })

  // Public half of an ephemeral ECDH key. Useless to anyone without the private half,
  // which never leaves the browser.
  socket.on('key-exchange', (data: { publicKey: string; to: string }) => {
    if (typeof data?.publicKey !== 'string' || data.publicKey.length > 512) return
    const peer = allowSignal() && peerOf(data.to)
    if (peer) io.to(peer.socketId).emit('key-exchange', { publicKey: data.publicKey, from: me()!.id })
  })

  // Chat messages arrive already encrypted. The server forwards ciphertext and keeps nothing.
  socket.on('send-message', (data: { text: string; to: string; encrypted?: boolean }) => {
    if (typeof data?.text !== 'string' || data.text.length > MAX_MESSAGE_CHARS) return
    if (!allowMessage()) return
    const peer = peerOf(data.to)
    if (peer) io.to(peer.socketId).emit('message', { text: data.text, encrypted: data.encrypted === true, from: me()!.id })
  })

  const unmatch = () => {
    const user = me()
    if (!user?.matchedWith) return
    const stranger = users.get(user.matchedWith)
    user.matchedWith = null
    if (stranger && stranger.matchedWith === user.id) {
      stranger.matchedWith = null
      io.to(stranger.socketId).emit('disconnected')
    }
  }

  socket.on('disconnect-stranger', () => unmatch())

  socket.on('report-user', (data: { reportedUserId: string }) => {
    const reporter = me()
    const reportedId = data?.reportedUserId
    if (!reporter || typeof reportedId !== 'string' || reportedId === reporter.id) return
    // You can only report someone you are talking to, or just talked to
    if (reporter.matchedWith !== reportedId && reporter.lastMatchedWith !== reportedId) {
      return
    }

    // Count unique reporters (by hashed network), so one person cannot ban someone alone
    if (!reportsAgainst.has(reportedId)) reportsAgainst.set(reportedId, new Set())
    const reporters = reportsAgainst.get(reportedId)!
    reporters.add(reporter.ipHash)
    reporter.lastMatchedWith = null

    if (reporters.size >= BAN_THRESHOLD) {
      const reported = users.get(reportedId)
      bannedUsers.add(reportedId)
      if (reported) {
        bannedIpHashes.add(reported.ipHash)
        io.to(reported.socketId).emit('banned', { reason: BAN_REASON })
        io.sockets.sockets.get(reported.socketId)?.disconnect()
      }
      reportsAgainst.delete(reportedId)
      console.log(`ban issued (total bans: ${bannedUsers.size})`)
    }

    socket.emit('report-confirmed', { message: 'Report submitted. Thank you for keeping the community safe.' })
  })

  socket.on('disconnect', () => {
    const user = me()
    if (user) {
      unmatch()
      const i = waitingQueue.indexOf(user.id)
      if (i > -1) waitingQueue.splice(i, 1)
      users.delete(user.id)
    }
    socketToUser.delete(socket.id)
  })
})

// Periodic, anonymous health line
setInterval(() => {
  console.log(`online=${users.size} waiting=${waitingQueue.length}`)
}, 60_000).unref()

const PORT = Number(process.env.PORT) || 3001
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
