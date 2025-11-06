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
    const [showPlayButton, setShowPlayButton] = useState(false)

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

        // WebRTC Connection State Monitoring - ICE Candidates
        // Note: ICE candidate sending is handled in the socket effect, but we log here
        // The actual sending will be set up after socket is available

        pc.oniceconnectionstatechange = () => {
            console.log('🔗 ICE connection state:', pc.iceConnectionState)
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                console.error('❌ ICE connection failed/disconnected!')
            }
        }

        pc.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', pc.connectionState)
            if (pc.connectionState === 'failed') {
                console.error('❌ WebRTC connection failed!')
            } else if (pc.connectionState === 'connected') {
                console.log('✅✅✅ WebRTC CONNECTED! ✅✅✅')
            }
        }

        pc.onicegatheringstatechange = () => {
            console.log('🧊 ICE gathering state:', pc.iceGatheringState)
        }

        pc.onsignalingstatechange = () => {
            console.log('📡 Signaling state:', pc.signalingState)
        }

        pc.ontrack = (event) => {
            console.log('📥 Received remote track:', event.track.kind, event.track.readyState)
            console.log('📊 Track details:', {
                enabled: event.track.enabled,
                muted: event.track.muted,
                readyState: event.track.readyState,
                streams: event.streams.length,
                id: event.track.id,
                label: event.track.label
            })

            // CRITICAL: Verify this is NOT our local stream
            const remoteStream = event.streams[0]
            if (remoteStream && localStreamRef.current) {
                const remoteStreamId = remoteStream.id
                const localStreamId = localStreamRef.current.id
                if (remoteStreamId === localStreamId) {
                    console.error('❌❌❌ ERROR: Remote stream ID matches local stream ID! This is our own stream!')
                    return
                }
                console.log('✅ Stream ID check passed:', {
                    remoteStreamId,
                    localStreamId,
                    match: remoteStreamId === localStreamId
                })
            }

            // Verify track is actually active
            const videoTrack = event.track.kind === 'video' ? event.track : null
            if (videoTrack) {
                console.log('🎥 Video track status:', {
                    enabled: videoTrack.enabled,
                    muted: videoTrack.muted,
                    readyState: videoTrack.readyState,
                    id: videoTrack.id,
                    label: videoTrack.label
                })

                // Monitor track state changes
                videoTrack.onended = () => {
                    console.error('❌ Remote video track ended!')
                }
                videoTrack.onmute = () => {
                    console.warn('⚠️ Remote video track muted!')
                }
                videoTrack.onunmute = () => {
                    console.log('✅ Remote video track unmuted!')
                }
            }

            if (event.track.kind === 'video' && remoteVideoRef.current && event.streams[0]) {
                console.log('🎥 Setting remote VIDEO stream')
                console.log('Stream ID:', event.streams[0].id)
                console.log('Video tracks in stream:', event.streams[0].getVideoTracks().length)

                // CRITICAL: Verify stream has active video tracks
                const videoTracks = event.streams[0].getVideoTracks()
                if (videoTracks.length === 0) {
                    console.error('❌❌❌ ERROR: Stream has NO video tracks!')
                    return
                }

                const activeVideoTrack = videoTracks.find(t => t.enabled && t.readyState === 'live')
                if (!activeVideoTrack) {
                    console.error('❌❌❌ ERROR: No active video track found in stream!')
                    console.log('Available tracks:', videoTracks.map(t => ({
                        enabled: t.enabled,
                        readyState: t.readyState,
                        muted: t.muted
                    })))
                    return
                }

                console.log('✅ Found active video track:', {
                    id: activeVideoTrack.id,
                    enabled: activeVideoTrack.enabled,
                    readyState: activeVideoTrack.readyState,
                    muted: activeVideoTrack.muted
                })

                // CRITICAL: Check if video element still exists
                if (!remoteVideoRef.current) {
                    console.error('❌❌❌ remoteVideoRef.current is NULL! Video element was removed!')
                    return
                }

                // Set stream (only once)
                if (!remoteVideoRef.current.srcObject) {
                    console.log('Setting srcObject for the first time...')

                    // CRITICAL: Make video visible FIRST before setting srcObject
                    // Hidden elements can't load MediaStreams properly
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.style.display = 'block'
                        remoteVideoRef.current.style.opacity = '1'
                        remoteVideoRef.current.style.visibility = 'visible'
                        console.log('✅ Made video visible BEFORE setting stream')
                    }

                    // NOW set the stream
                    remoteVideoRef.current.srcObject = event.streams[0]

                    // Verify srcObject was set
                    console.log('✅ srcObject set:', {
                        hasSrcObject: !!remoteVideoRef.current.srcObject,
                        srcObjectType: remoteVideoRef.current.srcObject?.constructor?.name,
                        streamId: event.streams[0].id,
                        videoTracks: event.streams[0].getVideoTracks().length,
                        audioTracks: event.streams[0].getAudioTracks().length
                    })

                    // Verify video element dimensions and positioning
                    const videoRect = remoteVideoRef.current.getBoundingClientRect()
                    console.log('📐 Video element dimensions:', {
                        width: videoRect.width,
                        height: videoRect.height,
                        top: videoRect.top,
                        left: videoRect.left,
                        display: window.getComputedStyle(remoteVideoRef.current).display,
                        visibility: window.getComputedStyle(remoteVideoRef.current).visibility,
                        opacity: window.getComputedStyle(remoteVideoRef.current).opacity,
                        zIndex: window.getComputedStyle(remoteVideoRef.current).zIndex
                    })

                    setRemoteVideoReady(true) // Set immediately so video is visible

                    // Try to play IMMEDIATELY - don't wait for events
                    const tryPlayVideo = (attempt = 1) => {
                        if (!remoteVideoRef.current) {
                            console.error('❌ Video ref is null')
                            return
                        }

                        console.log(`🎬 Play attempt ${attempt}:`, {
                            readyState: remoteVideoRef.current.readyState,
                            paused: remoteVideoRef.current.paused,
                            srcObject: !!remoteVideoRef.current.srcObject,
                            videoWidth: remoteVideoRef.current.videoWidth,
                            videoHeight: remoteVideoRef.current.videoHeight,
                            dimensions: `${remoteVideoRef.current.getBoundingClientRect().width}x${remoteVideoRef.current.getBoundingClientRect().height}`
                        })

                        // Try play
                        remoteVideoRef.current.play()
                            .then(() => {
                                console.log('✅✅✅ REMOTE VIDEO PLAYING! ✅✅✅')
                                console.log('Video dimensions:', remoteVideoRef.current?.videoWidth, 'x', remoteVideoRef.current?.videoHeight)
                                setShowPlayButton(false)
                            })
                            .catch((error) => {
                                console.error(`❌ Play attempt ${attempt} failed:`, error)
                                const errorObj = error as Error
                                const errorName = errorObj.name || 'Unknown'

                                if (errorName === 'NotAllowedError') {
                                    console.warn('⚠️ Autoplay blocked - showing play button')
                                    setShowPlayButton(true)
                                } else if (attempt < 5) {
                                    // Retry - MediaStream might need time
                                    setTimeout(() => tryPlayVideo(attempt + 1), 300 * attempt)
                                }
                            })
                    }

                    // Try play immediately
                    setTimeout(() => tryPlayVideo(), 100)

                    // Also set up event handlers as backup
                    remoteVideoRef.current.oncanplay = () => {
                        console.log('✅✅✅ CAN PLAY event fired! ✅✅✅')
                        if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                            tryPlayVideo(999) // Mark as event-driven
                        }
                    }

                    remoteVideoRef.current.onloadedmetadata = () => {
                        console.log('✅✅✅ METADATA LOADED event fired! ✅✅✅')
                        console.log('📊 Metadata loaded state:', {
                            videoWidth: remoteVideoRef.current?.videoWidth,
                            videoHeight: remoteVideoRef.current?.videoHeight,
                            readyState: remoteVideoRef.current?.readyState,
                            duration: remoteVideoRef.current?.duration
                        })
                        if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                            tryPlayVideo(999) // Mark as event-driven
                        }
                    }

                    remoteVideoRef.current.onloadeddata = () => {
                        console.log('✅✅✅ DATA LOADED event fired! ✅✅✅')
                        console.log('📊 Data loaded state:', {
                            videoWidth: remoteVideoRef.current?.videoWidth,
                            videoHeight: remoteVideoRef.current?.videoHeight,
                            readyState: remoteVideoRef.current?.readyState
                        })
                    }

                    remoteVideoRef.current.onplay = () => {
                        console.log('✅✅✅ PLAY event fired! Video is playing! ✅✅✅')
                    }

                    remoteVideoRef.current.onplaying = () => {
                        console.log('✅✅✅ PLAYING event fired! Video is actively playing! ✅✅✅')
                    }

                    remoteVideoRef.current.onpause = () => {
                        console.warn('⚠️ Video paused')
                    }

                    remoteVideoRef.current.onwaiting = () => {
                        console.warn('⚠️ Video waiting for data')
                    }

                    remoteVideoRef.current.onstalled = () => {
                        console.error('❌ Video stalled')
                    }

                    remoteVideoRef.current.onsuspend = () => {
                        console.warn('⚠️ Video suspended')
                    }

                    // Log current state
                    console.log('✅ srcObject set, checking:', {
                        hasSrcObject: !!remoteVideoRef.current.srcObject,
                        videoWidth: remoteVideoRef.current.videoWidth,
                        videoHeight: remoteVideoRef.current.videoHeight,
                        readyState: remoteVideoRef.current.readyState,
                        paused: remoteVideoRef.current.paused,
                        display: window.getComputedStyle(remoteVideoRef.current).display,
                        visibility: window.getComputedStyle(remoteVideoRef.current).visibility,
                        // Verify srcObject stream details
                        srcObjectStreamId: (remoteVideoRef.current.srcObject as MediaStream)?.id,
                        srcObjectVideoTracks: (remoteVideoRef.current.srcObject as MediaStream)?.getVideoTracks().length,
                        srcObjectAudioTracks: (remoteVideoRef.current.srcObject as MediaStream)?.getAudioTracks().length
                    })
                } else {
                    console.log('⚠️ srcObject already set, checking if it changed...')
                    if (remoteVideoRef.current.srcObject !== event.streams[0]) {
                        console.warn('⚠️ Stream changed! Updating...')
                        remoteVideoRef.current.srcObject = event.streams[0]
                    }
                }
            }
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 ICE candidate generated:', {
                    candidate: event.candidate.candidate.substring(0, 50) + '...',
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid
                })

                // Send ICE candidate if socket and strangerId are available
                // Note: socket and strangerId might not be available yet, so we'll set this up in the socket effect
                if (socket && strangerId) {
                    socket.emit('webrtc-ice', {
                        candidate: event.candidate,
                        to: strangerId,
                    })
                    console.log('📤 Sent ICE candidate to stranger')
                } else {
                    console.warn('⚠️ ICE candidate generated but socket/strangerId not ready yet')
                }
            } else {
                console.log('🧊 ICE gathering complete - no more candidates')
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

                {/* Video Container - ALWAYS in DOM, never display:none (breaks MediaStream loading) */}
                <div
                    className="mb-4 bg-black rounded-lg relative cursor-pointer"
                    style={{
                        aspectRatio: '16/9',
                        display: 'block', // Always block - never none (MediaStreams need visible parent)
                        opacity: isMatched ? '1' : '0', // Hide visually but keep in DOM
                        pointerEvents: isMatched ? 'auto' : 'none',
                        height: isMatched ? 'auto' : '0', // Collapse when not matched
                        overflow: 'hidden', // Keep overflow hidden but ensure video fills container
                        position: 'relative' // Establish positioning context
                    }}
                    onClick={() => {
                        // Make entire video area clickable to start playback
                        if (remoteVideoRef.current && remoteVideoRef.current.paused) {
                            remoteVideoRef.current.play()
                                .then(() => {
                                    console.log('✅ Video started after click')
                                    setShowPlayButton(false)
                                })
                                .catch(e => console.error('Click play failed:', e))
                        }
                    }}
                >
                    {/* Remote Video - ALWAYS in DOM, NEVER unmounted, NEVER conditionally rendered */}
                    {/* CRITICAL: Key prop prevents React reusing, always rendered */}
                    {/* Z-INDEX: 15 (above placeholder z-10, below local PIP z-20 and play button z-20) */}
                    <video
                        key="remote-video"
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={false}
                        className="w-full h-full object-cover bg-black"
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'block', // Always block, never none
                            // Show video if it has srcObject OR if remoteVideoReady is true
                            opacity: (() => {
                                const hasSrcObject = remoteVideoRef.current?.srcObject !== null && remoteVideoRef.current?.srcObject !== undefined
                                return isMatched && (hasSrcObject || remoteVideoReady) ? '1' : '0.01'
                            })(),
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 15, // Above placeholder (z-10), below local PIP (z-20)
                            pointerEvents: 'auto', // Always allow interaction
                            visibility: 'visible', // Always visible, never hidden
                            objectFit: 'cover', // Ensure video fills container
                            objectPosition: 'center' // Center the video
                        }}
                        onLoadedMetadata={() => {
                            console.log('🎥 Video metadata loaded in DOM')
                            console.log('📊 Video element state:', {
                                srcObject: !!remoteVideoRef.current?.srcObject,
                                readyState: remoteVideoRef.current?.readyState,
                                videoWidth: remoteVideoRef.current?.videoWidth,
                                videoHeight: remoteVideoRef.current?.videoHeight,
                                paused: remoteVideoRef.current?.paused
                            })
                            setRemoteVideoReady(true)
                        }}
                        onCanPlay={() => {
                            console.log('🎥 Video can play in DOM')
                            setRemoteVideoReady(true)
                        }}
                        onError={(e) => {
                            console.error('❌ Video element error:', e)
                            console.error('Video element:', remoteVideoRef.current)
                        }}
                    />

                    {/* Play Button - Shown when autoplay is blocked */}
                    {showPlayButton && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (remoteVideoRef.current) {
                                        remoteVideoRef.current.play()
                                            .then(() => {
                                                console.log('✅ Video started from button')
                                                setShowPlayButton(false)
                                            })
                                            .catch(err => console.error('Button play failed:', err))
                                    }
                                }}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg shadow-lg"
                            >
                                ▶️ Click to See Stranger
                            </button>
                        </div>
                    )}

                    {/* Placeholder - Only show if video has no srcObject */}
                    {(() => {
                        const hasSrcObject = remoteVideoRef.current?.srcObject !== null && remoteVideoRef.current?.srcObject !== undefined
                        return !hasSrcObject && !remoteVideoReady && isMatched
                    })() && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                            <div className="text-center">
                                <div className="text-6xl mb-4">👤</div>
                                <p>Waiting for stranger's video...</p>
                            </div>
                        </div>
                    )}

                    {/* Local Video (PIP) - Always show when matched */}
                    {isMatched && (
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
                    )}
                </div>

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
