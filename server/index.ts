import { Server } from 'socket.io'
import { createServer } from 'http'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*', // Allow all origins in production, or set specific URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

interface User {
  id: string
  socketId: string
  matchedWith: string | null
}

const users = new Map<string, User>()
const waitingQueue: string[] = []

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('register', (userId: string) => {
    users.set(userId, {
      id: userId,
      socketId: socket.id,
      matchedWith: null,
    })
    console.log('User registered:', userId)
  })

  socket.on('find-stranger', (userId: string) => {
    const user = users.get(userId)
    if (!user || user.matchedWith) return

    // Try to find a match
    if (waitingQueue.length > 0) {
      const strangerId = waitingQueue.shift()!
      const stranger = users.get(strangerId)

      if (stranger && !stranger.matchedWith) {
        // Match found!
        user.matchedWith = strangerId
        stranger.matchedWith = userId

        // Notify both users
        io.to(user.socketId).emit('matched', { strangerId })
        io.to(stranger.socketId).emit('matched', { strangerId: userId })

        console.log(`Matched ${userId} with ${strangerId}`)
      } else {
        // Stranger no longer available, add current user to queue
        waitingQueue.push(userId)
      }
    } else {
      // No one waiting, add to queue
      waitingQueue.push(userId)
      console.log(`User ${userId} added to waiting queue`)
    }
  })

  socket.on('cancel-search', () => {
    const userId = Array.from(users.entries()).find(
      ([_, user]) => user.socketId === socket.id
    )?.[0]

    if (userId) {
      const index = waitingQueue.indexOf(userId)
      if (index > -1) {
        waitingQueue.splice(index, 1)
        console.log(`User ${userId} cancelled search`)
      }
    }
  })

  socket.on('send-message', (data: { text: string; strangerId: string; senderId: string }) => {
    const sender = users.get(data.senderId)
    const stranger = users.get(data.strangerId)

    if (sender && stranger && sender.matchedWith === data.strangerId) {
      io.to(stranger.socketId).emit('message', {
        text: data.text,
        senderId: data.senderId,
      })
    }
  })

  // WebRTC signaling handlers
  socket.on('webrtc-offer', (data: { offer: RTCSessionDescriptionInit; strangerId: string; senderId: string }) => {
    const sender = users.get(data.senderId)
    const stranger = users.get(data.strangerId)
    
    if (sender && stranger && sender.matchedWith === data.strangerId) {
      io.to(stranger.socketId).emit('webrtc-offer', {
        offer: data.offer,
        senderId: data.senderId,
      })
    }
  })

  socket.on('webrtc-answer', (data: { answer: RTCSessionDescriptionInit; strangerId: string; senderId: string }) => {
    const sender = users.get(data.senderId)
    const stranger = users.get(data.strangerId)
    
    if (sender && stranger && sender.matchedWith === data.strangerId) {
      io.to(stranger.socketId).emit('webrtc-answer', {
        answer: data.answer,
        senderId: data.senderId,
      })
    }
  })

  socket.on('webrtc-ice-candidate', (data: { candidate: RTCIceCandidateInit; strangerId: string; senderId: string }) => {
    const sender = users.get(data.senderId)
    const stranger = users.get(data.strangerId)
    
    if (sender && stranger && sender.matchedWith === data.strangerId) {
      io.to(stranger.socketId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
        senderId: data.senderId,
      })
    }
  })

  socket.on('disconnect-stranger', (data: { strangerId: string }) => {
    const userId = Array.from(users.entries()).find(
      ([_, user]) => user.socketId === socket.id
    )?.[0]

    if (userId) {
      const user = users.get(userId)
      const stranger = users.get(data.strangerId)

      if (user && user.matchedWith === data.strangerId) {
        user.matchedWith = null

        if (stranger) {
          stranger.matchedWith = null
          io.to(stranger.socketId).emit('disconnected')
        }
      }
    }
  })

  socket.on('disconnect', () => {
    const userId = Array.from(users.entries()).find(
      ([_, user]) => user.socketId === socket.id
    )?.[0]

    if (userId) {
      const user = users.get(userId)

      // If user was matched, notify their stranger
      if (user?.matchedWith) {
        const stranger = users.get(user.matchedWith)
        if (stranger) {
          stranger.matchedWith = null
          io.to(stranger.socketId).emit('disconnected')
        }
      }

      // Remove from waiting queue if present
      const queueIndex = waitingQueue.indexOf(userId)
      if (queueIndex > -1) {
        waitingQueue.splice(queueIndex, 1)
      }

      users.delete(userId)
      console.log('User disconnected:', userId)
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`)
})

