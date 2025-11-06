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
  const [chatMode, setChatMode] = useState<'text' | 'video'>('text')
  
  // Video chat state
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false)
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const userId = useRef(uuidv4())

  // Initialize WebRTC
  const initializePeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    }

    const pc = new RTCPeerConnection(configuration)
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.streams.length, 'streams')
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0]
        
        // Set attributes for iOS
        remoteVideoRef.current.setAttribute('playsinline', 'true')
        remoteVideoRef.current.setAttribute('webkit-playsinline', 'true')
        remoteVideoRef.current.setAttribute('x5-playsinline', 'true')
        
        // Force play with retry
        const playRemoteVideo = async (attempt = 1) => {
          try {
            await remoteVideoRef.current!.play()
            console.log('Remote video playing successfully')
            setRemoteVideoEnabled(true)
            
            // Ensure video is visible
            if (remoteVideoRef.current) {
              remoteVideoRef.current.style.display = 'block'
              remoteVideoRef.current.style.opacity = '1'
            }
          } catch (error) {
            console.error(`Error playing remote video (attempt ${attempt}):`, error)
            if (attempt < 3) {
              setTimeout(() => playRemoteVideo(attempt + 1), 200 * attempt)
            }
          }
        }
        
        playRemoteVideo()
        console.log('Remote video setup complete')
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && strangerId) {
        socket.emit('webrtc-ice-candidate', {
          candidate: event.candidate,
          strangerId,
          senderId: userId.current,
        })
      }
    }

    peerConnectionRef.current = pc
    return pc
  }

  // Get user media (camera/microphone)
  const startLocalStream = async () => {
    try {
      console.log('Requesting camera/microphone access...')
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
      
      console.log('Got media stream:', stream.id)
      console.log('Video tracks:', stream.getVideoTracks().length)
      console.log('Audio tracks:', stream.getAudioTracks().length)
      
      localStreamRef.current = stream
      
      // Check if video tracks are enabled
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        console.log('Video track enabled:', videoTrack.enabled)
        console.log('Video track readyState:', videoTrack.readyState)
        setIsVideoEnabled(videoTrack.enabled)
      }
      
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        setIsAudioEnabled(audioTrack.enabled)
      }
      
      // Set video element source
      if (localVideoRef.current) {
        console.log('Setting local video srcObject...')
        localVideoRef.current.srcObject = stream
        
        // Set video element attributes for iOS
        localVideoRef.current.setAttribute('playsinline', 'true')
        localVideoRef.current.setAttribute('webkit-playsinline', 'true')
        localVideoRef.current.setAttribute('x5-playsinline', 'true')
        
        // Force play with multiple attempts
        const playVideo = async (attempt = 1) => {
          try {
            await localVideoRef.current!.play()
            console.log('Local video playing successfully')
            
            // Double check video is actually playing
            if (localVideoRef.current) {
              localVideoRef.current.style.display = 'block'
              localVideoRef.current.style.opacity = '1'
              console.log('Video element display:', localVideoRef.current.style.display)
              console.log('Video element opacity:', localVideoRef.current.style.opacity)
              console.log('Video element srcObject:', !!localVideoRef.current.srcObject)
            }
          } catch (playError) {
            console.error(`Error playing local video (attempt ${attempt}):`, playError)
            if (attempt < 3) {
              // Try again after delay
              setTimeout(() => playVideo(attempt + 1), 200 * attempt)
            } else {
              console.error('Failed to play video after 3 attempts')
            }
          }
        }
        
        await playVideo()
      } else {
        console.warn('localVideoRef.current is null!')
      }

      // Add tracks to peer connection if it exists
      if (peerConnectionRef.current) {
        stream.getTracks().forEach((track) => {
          const existingSender = peerConnectionRef.current?.getSenders().find(
            (s) => s.track === track
          )
          if (!existingSender) {
            peerConnectionRef.current?.addTrack(track, stream)
            console.log('Added track to peer connection:', track.kind)
          }
        })
      }

      console.log('Local stream setup complete')
    } catch (error) {
      console.error('Error accessing media devices:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert('Could not access camera/microphone: ' + errorMessage + '\n\nPlease check your browser permissions.')
      setIsVideoEnabled(false)
      setIsAudioEnabled(false)
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
    
    setIsVideoEnabled(false)
  }

  // Toggle video
  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
        console.log('Video track enabled:', videoTrack.enabled)
        
        // Ensure video element is visible and playing
        if (localVideoRef.current && videoTrack.enabled) {
          localVideoRef.current.style.display = 'block'
          localVideoRef.current.play().catch((error) => {
            console.error('Error playing video after toggle:', error)
          })
        }
      }
    } else {
      // If no stream, try to start it
      await startLocalStream()
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

  // Switch chat mode
  const switchChatMode = async (mode: 'text' | 'video') => {
    setChatMode(mode)
    
    if (mode === 'video' && isMatched && strangerId) {
      try {
        console.log('Switching to video mode...')
        
        // Start local stream FIRST - this is critical
        if (!localStreamRef.current) {
          console.log('Starting local stream...')
          await startLocalStream()
        } else {
          console.log('Local stream already exists')
          // Make sure video is playing
          if (localVideoRef.current && localVideoRef.current.srcObject) {
            localVideoRef.current.play().catch((error) => {
              console.error('Error playing existing video:', error)
            })
          }
        }
        
        // Initialize peer connection
        if (!peerConnectionRef.current) {
          console.log('Initializing peer connection...')
          initializePeerConnection()
        }
        
        // Add tracks to peer connection
        if (peerConnectionRef.current && localStreamRef.current) {
          console.log('Adding tracks to peer connection...')
          localStreamRef.current.getTracks().forEach((track) => {
            const existingSender = peerConnectionRef.current?.getSenders().find(
              (s) => s.track === track
            )
            if (!existingSender) {
              peerConnectionRef.current?.addTrack(track, localStreamRef.current!)
              console.log('Added track:', track.kind, track.enabled)
            }
          })
        }
        
        // Create offer after everything is ready
        if (peerConnectionRef.current && socket && strangerId && localStreamRef.current) {
          console.log('Creating WebRTC offer...')
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })
          await peerConnectionRef.current.setLocalDescription(offer)
          
          socket.emit('webrtc-offer', {
            offer,
            strangerId,
            senderId: userId.current,
          })
          console.log('WebRTC offer sent')
        }
      } catch (error) {
        console.error('Error switching to video mode:', error)
        alert('Failed to start video: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    } else if (mode === 'text' && localStreamRef.current) {
      stopLocalStream()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
    }
  }

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
      stopLocalStream()
    })

    newSocket.on('matched', async (data: { strangerId: string }) => {
      setIsSearching(false)
      setIsMatched(true)
      setStrangerId(data.strangerId)
      setMessages([{
        id: uuidv4(),
        text: 'You are now connected! Say hello 👋',
        sender: 'stranger',
        timestamp: new Date(),
      }])

      // Note: Video initialization handled separately when user switches to video mode
    })

    newSocket.on('disconnected', () => {
      setIsMatched(false)
      setStrangerId(null)
      setRemoteVideoEnabled(false)
      stopLocalStream()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
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

    // WebRTC signaling handlers
    newSocket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit; senderId: string }) => {
      try {
        // If stranger sent an offer, switch to video mode and accept
        if (!isMatched) return
        
        // Switch to video mode if not already
        if (chatMode !== 'video') {
          setChatMode('video')
        }
        
        if (!peerConnectionRef.current) {
          initializePeerConnection()
          
          // Start local stream if not already started
          if (!localStreamRef.current) {
            await startLocalStream()
          }
        }

        if (peerConnectionRef.current && localStreamRef.current) {
          // Make sure all tracks are added
          localStreamRef.current.getTracks().forEach((track) => {
            const existingSender = peerConnectionRef.current?.getSenders().find(
              (s) => s.track === track
            )
            if (!existingSender) {
              peerConnectionRef.current?.addTrack(track, localStreamRef.current!)
            }
          })
          
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer))
          
          const answer = await peerConnectionRef.current.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })
          await peerConnectionRef.current.setLocalDescription(answer)
          
          if (strangerId) {
            newSocket.emit('webrtc-answer', {
              answer,
              strangerId,
              senderId: userId.current,
            })
          }
        }
      } catch (error) {
        console.error('Error handling WebRTC offer:', error)
      }
    })

    newSocket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit; senderId: string }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer))
      }
    })

    newSocket.on('webrtc-ice-candidate', async (data: { candidate: RTCIceCandidateInit; senderId: string }) => {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate))
      }
    })

    setSocket(newSocket)

    return () => {
      stopLocalStream()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
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
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
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
      setRemoteVideoEnabled(false)
      stopLocalStream()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
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

        {/* Chat Mode Toggle */}
        {isMatched && (
          <div className="mb-4 flex justify-center gap-4">
            <button
              onClick={() => switchChatMode('text')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                chatMode === 'text'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              💬 Text Chat
            </button>
            <button
              onClick={() => switchChatMode('video')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                chatMode === 'video'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              📹 Video Chat
            </button>
          </div>
        )}

        {/* Video Chat Container */}
        {chatMode === 'video' && isMatched && (
          <div className="mb-4 bg-black rounded-lg overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              muted={false}
              className="w-full h-full object-cover bg-black"
              style={{ 
                display: remoteVideoEnabled ? 'block' : 'none',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
            
            {/* Placeholder when no remote video */}
            {!remoteVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <div className="text-6xl mb-4">👤</div>
                  <p>Waiting for stranger to enable video...</p>
                </div>
              </div>
            )}

            {/* Local Video (Picture-in-Picture) */}
            {localStreamRef.current && (
              <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: 'black' }}
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
                title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isAudioEnabled ? '🎤' : '🔇'}
              </button>
            </div>
            
            {/* Debug Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-xs p-2 rounded z-10">
                <div>Local: {isVideoEnabled ? '✅' : '❌'}</div>
                <div>Remote: {remoteVideoEnabled ? '✅' : '❌'}</div>
                <div>Stream: {localStreamRef.current ? '✅' : '❌'}</div>
                <div>Peer: {peerConnectionRef.current ? '✅' : '❌'}</div>
              </div>
            )}
          </div>
        )}

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
          {chatMode === 'text' && (
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
          )}

          {/* Message Input */}
          {chatMode === 'text' && (
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
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>
            Made with ❤️ for connecting people •{' '}
            <a
              href="https://github.com/vamsikrishnakosuri/StrangersConnect"
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
