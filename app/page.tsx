'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'

interface Message {
    id: string
    text: string
    sender: 'me' | 'stranger'
}

export default function Home() {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [isMatched, setIsMatched] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [messageInput, setMessageInput] = useState('')
    const [strangerId, setStrangerId] = useState<string | null>(null)
    const [remoteVideoReady, setRemoteVideoReady] = useState(false)

    const userId = useRef(uuidv4())
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Initialize WebRTC peer connection
    const createPeerConnection = () => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        })

    pc.ontrack = (event) => {
      console.log('📥 Received remote track:', event.track.kind)
      if (remoteVideoRef.current && event.streams[0]) {
        console.log('Setting remote stream')
        
        // Only set stream once (on first track)
        if (!remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0]
          
          // Wait for video to be ready, then play
          remoteVideoRef.current.onloadedmetadata = () => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play()
                .then(() => {
                  console.log('✅ Remote video playing!')
                  setRemoteVideoReady(true)
                })
                .catch((e) => console.error('Remote play error:', e))
            }
          }
        }
      }
    }

        pc.onicecandidate = (event) => {
            if (event.candidate && socket && strangerId) {
                socket.emit('webrtc-ice', {
                    candidate: event.candidate,
                    to: strangerId,
                })
            }
        }

        peerConnectionRef.current = pc
        return pc
    }

    // Start local video - ONLY CALLED ONCE
    const startVideo = async () => {
        // Don't start again if already started
        if (localStreamRef.current && peerConnectionRef.current) {
            console.log('⚠️ Video already started, skipping')
            return peerConnectionRef.current
        }

        try {
            console.log('📷 Requesting camera access...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: true,
            })
            console.log('✅ Got camera access')

            localStreamRef.current = stream
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
                await localVideoRef.current.play()
                console.log('✅ Local video playing')
            }

            // Create peer connection
            const pc = createPeerConnection()

            // Add all tracks
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream)
                console.log('➕ Added track:', track.kind)
            })

            return pc
        } catch (error) {
            console.error('❌ Error starting video:', error)
            alert('Could not access camera/microphone')
        }
    }

    // Stop video
    const stopVideo = () => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
        peerConnectionRef.current?.close()
        peerConnectionRef.current = null
        setRemoteVideoReady(false)
    }

    // Socket.io connection
    useEffect(() => {
        const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001')

        newSocket.on('connect', () => {
            console.log('✅ Connected')
            setIsConnected(true)
            newSocket.emit('register', userId.current)
        })

        newSocket.on('disconnect', () => {
            setIsConnected(false)
            setIsMatched(false)
            setIsSearching(false)
            stopVideo()
        })

        newSocket.on('matched', async (data: { strangerId: string }) => {
            console.log('✅ Matched with:', data.strangerId)
            setIsSearching(false)
            setIsMatched(true)
            setStrangerId(data.strangerId)
            setMessages([{ id: uuidv4(), text: '🎥 Starting video...', sender: 'stranger' }])

            // ALWAYS start video for BOTH users - no matter who creates offer
            console.log('🎥 Starting camera...')
            await startVideo()
            console.log('✅ Camera ready')

            // Wait a moment to ensure peer connection is fully set up
            await new Promise(resolve => setTimeout(resolve, 500))

            // Only the user with smaller ID creates the offer (prevents glare)
            const shouldCreateOffer = userId.current < data.strangerId
            console.log('Should I create offer?', shouldCreateOffer, '(me:', userId.current, 'vs', data.strangerId, ')')

            if (shouldCreateOffer && peerConnectionRef.current) {
                const offer = await peerConnectionRef.current.createOffer()
                await peerConnectionRef.current.setLocalDescription(offer)
                newSocket.emit('webrtc-offer', { offer, to: data.strangerId })
                console.log('📤 Sent offer')
            } else {
                console.log('⏳ Waiting for offer from stranger')
            }
        })

        newSocket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
            console.log('📨 Received offer from:', data.from)

            // Video should already be started from 'matched' event
            // Just wait for peer connection to exist
            let retries = 0
            while (!peerConnectionRef.current && retries < 20) {
                await new Promise(resolve => setTimeout(resolve, 100))
                retries++
            }

            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(data.offer)
                const answer = await peerConnectionRef.current.createAnswer()
                await peerConnectionRef.current.setLocalDescription(answer)
                newSocket.emit('webrtc-answer', { answer, to: data.from })
                console.log('📤 Sent answer')
            } else {
                console.error('❌ Peer connection not ready after 2 seconds')
            }
        })

        newSocket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit }) => {
            console.log('📨 Received answer')
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(data.answer)
            }
        })

        newSocket.on('webrtc-ice', async (data: { candidate: RTCIceCandidateInit }) => {
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                await peerConnectionRef.current.addIceCandidate(data.candidate)
            }
        })

        newSocket.on('disconnected', () => {
            setIsMatched(false)
            setStrangerId(null)
            stopVideo()
            setMessages([{ id: uuidv4(), text: 'Stranger disconnected', sender: 'stranger' }])
        })

        newSocket.on('message', (data: { text: string }) => {
            setMessages((prev) => [...prev, { id: uuidv4(), text: data.text, sender: 'stranger' }])
        })

        setSocket(newSocket)

        return () => {
            stopVideo()
            newSocket.close()
        }
    }, [])

    const findStranger = () => {
        if (socket) {
            setIsSearching(true)
            socket.emit('find-stranger', userId.current)
        }
    }

    const disconnect = () => {
        if (socket && strangerId) {
            socket.emit('disconnect-stranger', { strangerId })
            setIsMatched(false)
            setStrangerId(null)
            setMessages([])
            stopVideo()
        }
    }

    const sendMessage = () => {
        if (messageInput.trim() && socket && strangerId) {
            setMessages((prev) => [...prev, { id: uuidv4(), text: messageInput, sender: 'me' }])
            socket.emit('send-message', { text: messageInput, to: strangerId })
            setMessageInput('')
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-bold mb-2">🎥 Strangers Connect</h1>
                    <p className="text-gray-400">Connect with strangers via video • Free & Open Source</p>
                    <div className="mt-2">
                        <span className={`px-3 py-1 rounded-full text-sm ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
                            {isConnected ? '● Online' : '● Offline'}
                        </span>
                    </div>
                </div>

                {/* Video Container */}
                {isMatched && (
                    <div className="mb-4 bg-black rounded-lg overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
            {/* Remote Video - Always rendered, never removed */}
            <video
              ref={remoteVideoRef}
              playsInline
              muted={false}
              className="w-full h-full object-cover bg-black"
            />

                        {/* Placeholder */}
                        {!remoteVideoReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">👤</div>
                                    <p>Waiting for stranger's video...</p>
                                </div>
                            </div>
                        )}

                        {/* Local Video (PIP) - Always show when matched */}
                        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black z-20">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)', display: 'block' }}
                            />
                        </div>
                    </div>
                )}

                {/* Chat */}
                {isMatched && (
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                        <h3 className="font-semibold mb-2">💬 Chat</h3>
                        <div className="h-32 overflow-y-auto mb-3 space-y-2">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`px-3 py-1 rounded-lg text-sm ${msg.sender === 'me' ? 'bg-blue-600' : 'bg-gray-700'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type a message..."
                                className="flex-1 px-3 py-2 rounded bg-gray-700 border-none outline-none"
                            />
                            <button onClick={sendMessage} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
                                Send
                            </button>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex justify-center gap-4">
                    {!isMatched && !isSearching && (
                        <button
                            onClick={findStranger}
                            disabled={!isConnected}
                            className="px-6 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-600"
                        >
                            Find Stranger
                        </button>
                    )}

                    {isSearching && (
                        <div className="px-6 py-3 bg-gray-700 rounded-lg font-semibold">
                            Searching...
                        </div>
                    )}

                    {isMatched && (
                        <button onClick={disconnect} className="px-6 py-3 bg-red-600 rounded-lg font-semibold hover:bg-red-700">
                            Disconnect
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-sm text-gray-400">
                    Made with ❤️ • <a href="https://github.com/vamsikrishnakosuri/StrangersConnect" className="text-blue-400 hover:underline">Open Source</a>
                </div>
            </div>
        </div>
    )
}
