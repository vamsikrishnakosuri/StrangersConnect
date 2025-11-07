import { Server } from 'socket.io'
import { createServer } from 'http'

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

interface User {
  id: string
  socketId: string
  matchedWith: string | null
  ipAddress?: string
}

interface UserReport {
  reportedUserId: string
  reporterUserId: string
  timestamp: number
  reason?: string
}

interface BannedUser {
  userId: string
  ipAddress?: string
  banReason: string
  bannedAt: number
  reportCount: number
}

const users = new Map<string, User>()
const waitingQueue: string[] = []
const userReports = new Map<string, UserReport[]>() // userId -> reports received
const bannedUsers = new Map<string, BannedUser>() // userId -> ban info
const bannedIPs = new Set<string>() // IP addresses that are banned

// Threshold for permanent ban (industry standard: 3-5 reports)
const BAN_THRESHOLD = 5

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  // Get IP address from socket
  const ipAddress = socket.handshake.address || socket.request.socket.remoteAddress || 'unknown'
  
  // Check if IP is banned
  if (bannedIPs.has(ipAddress)) {
    console.log(`🚫 Blocked banned IP: ${ipAddress}`)
    socket.emit('banned', { reason: 'Your IP address has been banned due to multiple reports of inappropriate behavior.' })
    socket.disconnect()
    return
  }

  socket.on('register', (userId: string) => {
    // Check if user is banned before allowing registration
    if (bannedUsers.has(userId)) {
      const banInfo = bannedUsers.get(userId)!
      console.log(`🚫 Blocked banned user: ${userId} (${banInfo.reportCount} reports)`)
      socket.emit('banned', { 
        reason: `Your account has been permanently banned due to ${banInfo.reportCount} reports of inappropriate behavior.`,
        reportCount: banInfo.reportCount
      })
      socket.disconnect()
      return
    }
    
    users.set(userId, {
      id: userId,
      socketId: socket.id,
      matchedWith: null,
      ipAddress: ipAddress,
    })
    console.log('User registered:', userId, 'IP:', ipAddress)
  })

  socket.on('find-stranger', (userId: string) => {
    // Check if user is banned before allowing search
    if (bannedUsers.has(userId)) {
      const banInfo = bannedUsers.get(userId)!
      console.log(`🚫 Blocked banned user from searching: ${userId}`)
      socket.emit('banned', { 
        reason: `Your account has been permanently banned due to ${banInfo.reportCount} reports of inappropriate behavior.`,
        reportCount: banInfo.reportCount
      })
      socket.disconnect()
      return
    }

    const user = users.get(userId)
    if (!user || user.matchedWith) return

    if (waitingQueue.length > 0) {
      const strangerId = waitingQueue.shift()!
      const stranger = users.get(strangerId)

      if (stranger && !stranger.matchedWith) {
        user.matchedWith = strangerId
        stranger.matchedWith = userId

        io.to(user.socketId).emit('matched', { strangerId })
        io.to(stranger.socketId).emit('matched', { strangerId: userId })

        console.log(`Matched ${userId} with ${strangerId}`)
      } else {
        waitingQueue.push(userId)
      }
    } else {
      waitingQueue.push(userId)
      console.log(`User ${userId} added to queue`)
    }
  })

  // WebRTC signaling
  socket.on('webrtc-offer', (data: { offer: any; to: string }) => {
    console.log('Forwarding offer to:', data.to)
    io.to(users.get(data.to)?.socketId || '').emit('webrtc-offer', {
      offer: data.offer,
      from: Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    })
  })

  socket.on('webrtc-answer', (data: { answer: any; to: string }) => {
    console.log('Forwarding answer to:', data.to)
    io.to(users.get(data.to)?.socketId || '').emit('webrtc-answer', {
      answer: data.answer,
      from: Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    })
  })

  socket.on('webrtc-ice', (data: { candidate: any; to: string }) => {
    const fromUserId = Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    const toUser = users.get(data.to)
    console.log(`🔊 SERVER: Forwarding ICE candidate from ${fromUserId} to ${data.to} (socketId: ${toUser?.socketId})`)
    console.log(`🔊 SERVER: Candidate data:`, { 
      hasCandidate: !!data.candidate, 
      candidateType: data.candidate?.type,
      candidatePreview: data.candidate?.candidate?.substring(0, 50) 
    })
    if (toUser?.socketId) {
      io.to(toUser.socketId).emit('webrtc-ice', {
        candidate: data.candidate,
        from: fromUserId
      })
      console.log(`✅ SERVER: ICE candidate emitted to socket ${toUser.socketId}`)
    } else {
      console.error(`❌ SERVER: Cannot forward ICE candidate - user ${data.to} not found or has no socketId`)
      console.error(`🔍 SERVER: Available users:`, Array.from(users.keys()))
    }
  })

  socket.on('send-message', (data: { text: string; to: string }) => {
    io.to(users.get(data.to)?.socketId || '').emit('message', {
      text: data.text,
      from: Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    })
  })

  socket.on('disconnect-stranger', (data: { strangerId: string }) => {
    const userId = Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    if (userId) {
      const user = users.get(userId)
      const stranger = users.get(data.strangerId)
      if (user && stranger && user.matchedWith === data.strangerId) {
        user.matchedWith = null
        stranger.matchedWith = null
        io.to(stranger.socketId).emit('disconnected')
      }
    }
  })

  // Report user handler
  socket.on('report-user', (data: { reportedUserId: string; reason?: string }) => {
    const reporterUserId = Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    const reportedUserId = data.reportedUserId
    
    if (!reporterUserId || !reportedUserId) {
      console.error('❌ Invalid report: missing user IDs')
      return
    }

    // Prevent self-reporting
    if (reporterUserId === reportedUserId) {
      console.warn('⚠️ User tried to report themselves:', reporterUserId)
      return
    }

    // Create report
    const report: UserReport = {
      reportedUserId: reportedUserId,
      reporterUserId: reporterUserId,
      timestamp: Date.now(),
      reason: data.reason || 'Inappropriate content'
    }

    // Add report to user's report list
    if (!userReports.has(reportedUserId)) {
      userReports.set(reportedUserId, [])
    }
    userReports.get(reportedUserId)!.push(report)

    const reportCount = userReports.get(reportedUserId)!.length
    console.log(`🚨 Report #${reportCount} received for user ${reportedUserId} from ${reporterUserId}`)

    // Check if user should be banned (5+ reports)
    if (reportCount >= BAN_THRESHOLD) {
      const reportedUser = users.get(reportedUserId)
      const ipAddress = reportedUser?.ipAddress || 'unknown'
      
      // Ban the user
      const banInfo: BannedUser = {
        userId: reportedUserId,
        ipAddress: ipAddress,
        banReason: `Received ${reportCount} reports for inappropriate behavior`,
        bannedAt: Date.now(),
        reportCount: reportCount
      }
      
      bannedUsers.set(reportedUserId, banInfo)
      if (ipAddress !== 'unknown') {
        bannedIPs.add(ipAddress)
      }

      console.log(`🚫 PERMANENT BAN: User ${reportedUserId} banned (${reportCount} reports, IP: ${ipAddress})`)

      // Disconnect the banned user if they're still connected
      if (reportedUser) {
        io.to(reportedUser.socketId).emit('banned', {
          reason: `Your account has been permanently banned due to ${reportCount} reports of inappropriate behavior.`,
          reportCount: reportCount
        })
        io.to(reportedUser.socketId).disconnect()
      }

      // Notify the reporter
      socket.emit('report-confirmed', {
        message: 'User has been reported and permanently banned.',
        reportCount: reportCount
      })
    } else {
      // Notify reporter
      socket.emit('report-confirmed', {
        message: 'Report submitted successfully.',
        reportCount: reportCount,
        threshold: BAN_THRESHOLD
      })
    }
  })

  socket.on('disconnect', () => {
    const userId = Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    if (userId) {
      const user = users.get(userId)
      if (user?.matchedWith) {
        const stranger = users.get(user.matchedWith)
        if (stranger) {
          stranger.matchedWith = null
          io.to(stranger.socketId).emit('disconnected')
        }
      }
      const queueIndex = waitingQueue.indexOf(userId)
      if (queueIndex > -1) waitingQueue.splice(queueIndex, 1)
      users.delete(userId)
      console.log('User disconnected:', userId)
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

