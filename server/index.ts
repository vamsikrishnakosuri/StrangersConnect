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
    io.to(users.get(data.to)?.socketId || '').emit('webrtc-ice', {
      candidate: data.candidate,
      from: Array.from(users.entries()).find(([_, u]) => u.socketId === socket.id)?.[0]
    })
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
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

