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
      console.log('📥 Received remote track:', event.track.kind, event.track.readyState)
      
      if (event.track.kind === 'video' && remoteVideoRef.current && event.streams[0]) {
        console.log('🎥 Setting remote VIDEO stream')
        console.log('Stream ID:', event.streams[0].id)
        console.log('Video tracks in stream:', event.streams[0].getVideoTracks().length)
        
        // Set stream (only once)
        if (!remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject = event.streams[0]
          console.log('✅ srcObject set, checking:', {
            hasSrcObject: !!remoteVideoRef.current.srcObject,
            videoWidth: remoteVideoRef.current.videoWidth,
            videoHeight: remoteVideoRef.current.videoHeight,
            readyState: remoteVideoRef.current.readyState
          })
          
          setRemoteVideoReady(true)
          
          // Make sure it's visible FIRST
          if (remoteVideoRef.current) {
            remoteVideoRef.current.style.display = 'block'
            remoteVideoRef.current.style.opacity = '1'
            remoteVideoRef.current.style.visibility = 'visible'
            console.log('✅ Forced video visibility')
          }
          
          // Try play with detailed logging
          const attemptPlay = async () => {
            if (!remoteVideoRef.current) {
              console.error('❌ remoteVideoRef is null!')
              return
            }
            
            try {
              await remoteVideoRef.current.play()
              console.log('✅✅✅ REMOTE VIDEO PLAYING! ✅✅✅')
              console.log('Video dimensions:', remoteVideoRef.current.videoWidth, 'x', remoteVideoRef.current.videoHeight)
            } catch (error) {
              console.error('❌ Play failed:', error)
              console.error('Error name:', error.name)
              console.error('Error message:', error.message)
              
              // If autoplay policy issue, show user a message
              if (error.name === 'NotAllowedError' || error.name === 'NotAllowedError') {
                console.warn('⚠️ Autoplay blocked - user interaction required')
                // Try again after a click
                document.addEventListener('click', () => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play()
                      .then(() => console.log('✅ Play succeeded after user click'))
                      .catch(e => console.error('Still failed after click:', e))
                  }
                }, { once: true })
              }
              
              // Retry once after delay
              setTimeout(() => {
                if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                  console.log('🔄 Retrying play()...')
                  remoteVideoRef.current.play()
                    .then(() => console.log('✅ Retry play succeeded!'))
                    .catch(e2 => console.error('❌ Retry play failed:', e2))
                }
              }, 1000)
            }
          }
          
          // Try play immediately
          attemptPlay()
        } else {
          console.log('⚠️ srcObject already set, skipping')
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
            console.log('✅ Got camera access')
            console.log('📹 Video tracks:', stream.getVideoTracks().length)
            console.log('🎤 Audio tracks:', stream.getAudioTracks().length)

            localStreamRef.current = stream

            // Ensure local video is visible
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream
                localVideoRef.current.playsInline = true
                localVideoRef.current.autoplay = true
                localVideoRef.current.muted = true

                try {
                    await localVideoRef.current.play()
                    console.log('✅ Local video playing')
                } catch (e) {
                    console.error('Local video play error:', e)
                }
            }

            // Create peer connection
            const pc = createPeerConnection()

            // Add all tracks - CRITICAL for sending video
            stream.getTracks().forEach((track) => {
                const sender = pc.addTrack(track, stream)
                console.log('➕ Added track:', track.kind, '- Enabled:', track.enabled, '- ReadyState:', track.readyState)

                // Monitor track state
                track.onended = () => console.warn('⚠️ Track ended:', track.kind)
                track.onmute = () => console.warn('⚠️ Track muted:', track.kind)
                track.onunmute = () => console.log('✅ Track unmuted:', track.kind)
            })

            console.log('📊 Peer connection senders:', pc.getSenders().length)

            return pc
        } catch (error) {
            console.error('❌ Error starting video:', error)
            alert('Could not access camera/microphone: ' + (error instanceof Error ? error.message : 'Unknown'))
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
            const pc = await startVideo()

            if (!pc) {
                console.error('❌ Failed to start video')
                return
            }

            console.log('✅ Camera ready, peer connection:', !!pc)

            // Wait a moment to ensure peer connection is fully set up
            await new Promise(resolve => setTimeout(resolve, 300))

            // Only the user with smaller ID creates the offer (prevents glare)
            const shouldCreateOffer = userId.current < data.strangerId
            console.log('Should I create offer?', shouldCreateOffer, '(me:', userId.current, 'vs', data.strangerId, ')')

            if (shouldCreateOffer && peerConnectionRef.current) {
                try {
                    const offer = await peerConnectionRef.current.createOffer()
                    await peerConnectionRef.current.setLocalDescription(offer)
                    newSocket.emit('webrtc-offer', { offer, to: data.strangerId })
                    console.log('📤 Sent offer to:', data.strangerId)
                } catch (error) {
                    console.error('❌ Error creating offer:', error)
                }
            } else {
                console.log('⏳ Waiting for offer from stranger')
            }
        })

        newSocket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
            console.log('📨 Received offer from:', data.from)

            // Wait for peer connection - camera might still be starting
            let retries = 0
            while (!peerConnectionRef.current && retries < 50) {
                await new Promise(resolve => setTimeout(resolve, 100))
                retries++
                if (retries % 10 === 0) {
                    console.log(`⏳ Waiting for peer connection... (${retries * 100}ms)`)
                }
            }

            if (peerConnectionRef.current) {
                try {
                    await peerConnectionRef.current.setRemoteDescription(data.offer)
                    console.log('✅ Set remote description')

                    const answer = await peerConnectionRef.current.createAnswer()
                    await peerConnectionRef.current.setLocalDescription(answer)
                    console.log('✅ Created and set local answer')

                    newSocket.emit('webrtc-answer', { answer, to: data.from })
                    console.log('📤 Sent answer to:', data.from)
                } catch (error) {
                    console.error('❌ Error handling offer:', error)
                }
            } else {
                console.error('❌ Peer connection not ready after 5 seconds - camera may have failed')
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
                            autoPlay
                            playsInline
                            muted={false}
                            className="w-full h-full object-cover bg-black"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'block',
                                opacity: remoteVideoReady ? '1' : '0',
                                visibility: remoteVideoReady ? 'visible' : 'hidden'
                            }}
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
