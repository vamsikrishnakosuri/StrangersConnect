'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import Peer, { MediaConnection } from 'peerjs'

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

    // Video chat state
    const [isVideoEnabled, setIsVideoEnabled] = useState(false)
    const [isAudioEnabled, setIsAudioEnabled] = useState(true)
    const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const userId = useRef(uuidv4())
    const peerRef = useRef<Peer | null>(null)
    const callRef = useRef<MediaConnection | null>(null)

    // Initialize PeerJS
    useEffect(() => {
        console.log('🚀 Initializing PeerJS with ID:', userId.current)

        // Use our own PeerJS server on Railway
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'
        const peerHost = socketUrl.replace('https://', '').replace('http://', '').replace(':3001', '').replace(':8080', '')
        const isLocal = socketUrl.includes('localhost')

        console.log('PeerJS connecting to:', peerHost)

        const peer = new Peer(userId.current, {
            host: peerHost,
            port: isLocal ? 3001 : 443,
            path: '/peerjs',
            secure: !isLocal,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            }
        })

        peer.on('open', (id) => {
            console.log('✅ PeerJS connected with ID:', id)
            peerRef.current = peer
        })

        peer.on('call', (call) => {
            console.log('📞 Incoming call from:', call.peer)

            if (localStreamRef.current) {
                console.log('Answering call with existing stream')
                call.answer(localStreamRef.current)
            } else {
                console.log('Starting stream to answer call')
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then((stream) => {
                        localStreamRef.current = stream
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = stream
                            localVideoRef.current.play()
                        }
                        call.answer(stream)
                    })
                    .catch((error) => {
                        console.error('Error getting media for answer:', error)
                    })
            }

            call.on('stream', (remoteStream) => {
                console.log('🎥 Received remote stream from:', call.peer)
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream
                    remoteVideoRef.current.play()
                        .then(() => {
                            console.log('✅ Remote video playing!')
                            setRemoteVideoEnabled(true)
                        })
                        .catch((error) => {
                            console.error('Error playing remote video:', error)
                        })
                }
            })

            callRef.current = call
        })

        peer.on('error', (error) => {
            console.error('PeerJS error:', error)
        })

        return () => {
            peer.destroy()
        }
    }, [])

    // Get user media
    const startLocalStream = async () => {
        try {
            console.log('📷 Requesting camera/microphone access...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
            })

            console.log('✅ Got media stream:', stream.id)
            localStreamRef.current = stream

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
                await localVideoRef.current.play()
                console.log('✅ Local video playing')
            }

            setIsVideoEnabled(true)
            setIsAudioEnabled(true)
        } catch (error) {
            console.error('Error accessing media devices:', error)
            alert('Could not access camera/microphone: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    }

    // Stop local stream
    const stopLocalStream = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop())
            localStreamRef.current = null
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null
        }

        if (callRef.current) {
            callRef.current.close()
            callRef.current = null
        }

        setIsVideoEnabled(false)
        setIsAudioEnabled(false)
    }

    // Toggle video
    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsVideoEnabled(videoTrack.enabled)
            }
        }
    }

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  // Start video call (auto-triggered on match)
  const startVideoCall = async () => {
    if (!isMatched || !strangerId) return
    
    try {
      console.log('🎥 Starting video call...')
      
      // Start local stream
      if (!localStreamRef.current) {
        await startLocalStream()
      }
      
      // Call the stranger using PeerJS
      if (peerRef.current && localStreamRef.current && strangerId) {
        console.log('📞 Calling stranger:', strangerId)
        const call = peerRef.current.call(strangerId, localStreamRef.current)
        
        call.on('stream', (remoteStream) => {
          console.log('🎥 Received remote stream!')
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream
            remoteVideoRef.current.play()
              .then(() => {
                console.log('✅ Remote video playing!')
                setRemoteVideoEnabled(true)
              })
              .catch((error) => {
                console.error('Error playing remote video:', error)
              })
          }
        })
        
        callRef.current = call
      }
    } catch (error) {
      console.error('Error starting video call:', error)
      alert('Failed to start video: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

    // Socket.io for chat matching
    useEffect(() => {
        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
            transports: ['websocket'],
        })

        newSocket.on('connect', () => {
            setIsConnected(true)
            newSocket.emit('register', userId.current)
            console.log('✅ Connected to chat server')
        })

        newSocket.on('disconnect', () => {
            setIsConnected(false)
            setIsMatched(false)
            setIsSearching(false)
            stopLocalStream()
        })

    newSocket.on('matched', async (data: { strangerId: string }) => {
      console.log('✅ Match found! Stranger ID:', data.strangerId)
      setIsSearching(false)
      setIsMatched(true)
      setStrangerId(data.strangerId)
      setMessages([{
        id: uuidv4(),
        text: 'You are now connected! Starting video... 🎥',
        sender: 'stranger',
        timestamp: new Date(),
      }])
      
      // Auto-start video like Omegle
      setTimeout(() => startVideoCall(), 500)
    })

        newSocket.on('disconnected', () => {
            setIsMatched(false)
            setStrangerId(null)
            setRemoteVideoEnabled(false)
            stopLocalStream()
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
            stopLocalStream()
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
            setRemoteVideoEnabled(false)
            stopLocalStream()
            socket.emit('find-stranger', userId.current)
        }
    }

    const disconnectStranger = () => {
        if (socket && strangerId) {
            socket.emit('disconnect-stranger', { strangerId })
            setIsMatched(false)
            setStrangerId(null)
            setMessages([])
            setRemoteVideoEnabled(false)
            stopLocalStream()
        }
    }

    const sendMessage = () => {
        if (messageInput.trim() && socket && strangerId) {
            const newMessage: Message = {
                id: uuidv4(),
                text: messageInput,
                sender: 'me',
                timestamp: new Date(),
            }

            setMessages((prev) => [...prev, newMessage])

            socket.emit('send-message', {
                text: messageInput,
                strangerId,
                senderId: userId.current,
            })

            setMessageInput('')
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
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

                {/* Chat Mode Toggle */}
                {isMatched && (
                    <div className="mb-4 flex justify-center gap-4">
                        <button
                            onClick={() => switchChatMode('text')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${chatMode === 'text'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            💬 Text Chat
                        </button>
                        <button
                            onClick={() => switchChatMode('video')}
                            className={`px-4 py-2 rounded-lg font-semibold transition ${chatMode === 'video'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            📹 Video Chat
                        </button>
                    </div>
                )}

        {/* Video Chat Container - Always shown when matched */}
        {isMatched && (
                    <div className="mb-4 bg-black rounded-lg overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
                        {/* Remote Video */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            muted={false}
                            className="w-full h-full object-cover bg-black"
                            style={{
                                display: remoteVideoEnabled ? 'block' : 'none',
                            }}
                        />

                        {/* Placeholder when no remote video */}
                        {!remoteVideoEnabled && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">👤</div>
                                    <p>Waiting for stranger's video...</p>
                                </div>
                            </div>
                        )}

            {/* Local Video (Picture-in-Picture) */}
            {isMatched && (
                            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-20">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{
                                        backgroundColor: 'black',
                                        transform: 'scaleX(-1)',
                                    }}
                                />
                            </div>
                        )}

                        {/* Video Controls */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                            <button
                                onClick={toggleVideo}
                                className={`p-3 rounded-full ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white hover:opacity-80 transition`}
                                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {isVideoEnabled ? '📹' : '📷'}
                            </button>
                            <button
                                onClick={toggleAudio}
                                className={`p-3 rounded-full ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-600'} text-white hover:opacity-80 transition`}
                                title={isAudioEnabled ? 'Mute' : 'Unmute'}
                            >
                                {isAudioEnabled ? '🎤' : '🔇'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Text Chat Container */}
                {chatMode === 'text' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-4" style={{ minHeight: '400px' }}>
                        {/* Messages */}
                        <div className="h-80 overflow-y-auto mb-4 space-y-2">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs px-4 py-2 rounded-lg ${message.sender === 'me'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                                            }`}
                                    >
                                        {message.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        {isMatched && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                    onClick={sendMessage}
                                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                                >
                                    Send
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center gap-4 mb-4">
                    {!isMatched && !isSearching && (
                        <button
                            onClick={findStranger}
                            disabled={!isConnected}
                            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                        >
                            Find Stranger
                        </button>
                    )}

                    {isSearching && (
                        <div className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold">
                            Searching for stranger...
                        </div>
                    )}

                    {isMatched && (
                        <button
                            onClick={disconnectStranger}
                            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                        >
                            Disconnect
                        </button>
                    )}
                </div>

                {/* Status Bar */}
                <div className="bg-primary-600 text-white rounded-lg p-4 text-center">
                    {isMatched ? (
                        <div>
                            <p className="font-semibold">Chat Active</p>
                            <p className="text-sm">You are connected!</p>
                        </div>
                    ) : (
                        <div>
                            <p className="font-semibold">No Active Chat</p>
                            <p className="text-sm">Click "Find Stranger" to start chatting</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    Made with ❤️ for connecting people • <a href="https://github.com/vamsikrishnakosuri/StrangersConnect" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Open Source on GitHub</a>
                </div>
            </div>
        </div>
    )
}

