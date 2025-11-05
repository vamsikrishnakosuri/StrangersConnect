'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

interface Message {
  id: string
  text: string
  sender: 'me' | 'stranger'
  timestamp: Date
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isMatched, setIsMatched] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [strangerId, setStrangerId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userId = useRef(uuidv4())

  useEffect(() => {
    // Connect to Socket.io server
    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
      newSocket.emit('register', userId.current)
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      setIsMatched(false)
      setIsSearching(false)
    })

    newSocket.on('matched', (data: { strangerId: string }) => {
      setIsSearching(false)
      setIsMatched(true)
      setStrangerId(data.strangerId)
      setMessages([{
        id: uuidv4(),
        text: 'You are now connected! Say hello 👋',
        sender: 'stranger',
        timestamp: new Date(),
      }])
    })

    newSocket.on('disconnected', () => {
      setIsMatched(false)
      setStrangerId(null)
      setMessages([{
        id: uuidv4(),
        text: 'Stranger disconnected. Click "Find Stranger" to connect with someone new.',
        sender: 'stranger',
        timestamp: new Date(),
      }])
    })

    newSocket.on('message', (data: { text: string; senderId: string }) => {
      if (data.senderId !== userId.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            text: data.text,
            sender: 'stranger',
            timestamp: new Date(),
          },
        ])
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const findStranger = () => {
    if (socket && isConnected) {
      setIsSearching(true)
      setIsMatched(false)
      setMessages([])
      setStrangerId(null)
      socket.emit('find-stranger', userId.current)
    }
  }

  const disconnect = () => {
    if (socket && isMatched) {
      socket.emit('disconnect-stranger', { strangerId })
      setIsMatched(false)
      setIsSearching(false)
      setStrangerId(null)
      setMessages([])
    }
  }

  const sendMessage = () => {
    if (socket && messageInput.trim() && isMatched && strangerId) {
      const message: Message = {
        id: uuidv4(),
        text: messageInput,
        sender: 'me',
        timestamp: new Date(),
      }
      
      setMessages((prev) => [...prev, message])
      socket.emit('send-message', {
        text: messageInput,
        strangerId,
        senderId: userId.current,
      })
      setMessageInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-700 dark:text-primary-300 mb-2">
            Strangers Connect
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Connect with strangers from around the world • Free & Open Source
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          {/* Chat Header */}
          <div className="bg-primary-600 dark:bg-primary-700 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-white font-semibold text-lg">
                {isMatched ? 'Chat Active' : isSearching ? 'Searching for stranger...' : 'Not Connected'}
              </h2>
              <p className="text-primary-100 text-sm">
                {isMatched ? 'You are connected!' : isSearching ? 'Please wait...' : 'Click "Find Stranger" to start'}
              </p>
            </div>
            <div className="flex gap-2">
              {!isMatched && !isSearching && (
                <button
                  onClick={findStranger}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Find Stranger
                </button>
              )}
              {isSearching && (
                <button
                  onClick={() => {
                    socket?.emit('cancel-search')
                    setIsSearching(false)
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                >
                  Cancel
                </button>
              )}
              {isMatched && (
                <button
                  onClick={disconnect}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="h-96 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 && !isSearching && (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p className="text-center">
                  {isMatched ? 'Start the conversation!' : 'No messages yet. Find a stranger to begin chatting.'}
                </p>
              </div>
            )}
            
            {isSearching && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Searching for a stranger...</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'me'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === 'me' ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isMatched ? "Type a message..." : "Connect with a stranger first"}
                disabled={!isMatched}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!isMatched || !messageInput.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>
            Made with ❤️ for connecting people •{' '}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              Open Source on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

