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
    const [hasRemoteStream, setHasRemoteStream] = useState(false) // Track when srcObject is set
    const [showPlayButton, setShowPlayButton] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(true) // Dark mode by default

    // Video swap state - true means local is main, false means remote is main
    const [isLocalMain, setIsLocalMain] = useState(false)

    // Zoom state for videos
    const [remoteVideoZoom, setRemoteVideoZoom] = useState(1)
    const [remoteVideoPosition, setRemoteVideoPosition] = useState({ x: 0, y: 0 })
    const [remoteVideoDragging, setRemoteVideoDragging] = useState(false)
    const [remoteVideoDragStart, setRemoteVideoDragStart] = useState({ x: 0, y: 0 })
    const [remoteVideoLastTouch, setRemoteVideoLastTouch] = useState<{ distance: number; center: { x: number; y: number } } | null>(null)

    const [localVideoZoom, setLocalVideoZoom] = useState(1)
    const [localVideoPosition, setLocalVideoPosition] = useState({ x: 0, y: 0 })
    const [localVideoDragging, setLocalVideoDragging] = useState(false)
    const [localVideoDragStart, setLocalVideoDragStart] = useState({ x: 0, y: 0 })
    const [localVideoLastTouch, setLocalVideoLastTouch] = useState<{ distance: number; center: { x: number; y: number } } | null>(null)

    // Audio control state
    const [isLocalAudioMuted, setIsLocalAudioMuted] = useState(false)
    const [localAudioVolume, setLocalAudioVolume] = useState(100) // 0-100
    const [remoteAudioVolume, setRemoteAudioVolume] = useState(100) // 0-100
    const [showAudioControls, setShowAudioControls] = useState(false)

    // Camera control state
    const [isLocalCameraEnabled, setIsLocalCameraEnabled] = useState(true)

    // Report state
    const [showReportModal, setShowReportModal] = useState(false)

    const userId = useRef(uuidv4())
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const encryptionKeyRef = useRef<CryptoKey | null>(null) // Shared encryption key for E2E encryption
    const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]) // Queue ICE candidates until strangerId is ready
    const pendingReceivedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]) // Queue ICE candidates received before peer connection is ready
    const socketRef = useRef<Socket | null>(null) // Ref to access current socket in ICE candidate handler
    const strangerIdRef = useRef<string | null>(null) // Ref to access current strangerId in ICE candidate handler

    // End-to-End Encryption Functions (using Web Crypto API - FREE, built into browsers)
    const generateEncryptionKey = async (user1Id: string, user2Id: string): Promise<CryptoKey> => {
        // Create a deterministic key from both user IDs (same key for both users)
        const keyMaterial = `${user1Id}:${user2Id}` // Combined string
        const encoder = new TextEncoder()
        const data = encoder.encode(keyMaterial)

        // Hash the combined string to get consistent key material
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)

        // Import the key for AES-GCM encryption
        const key = await crypto.subtle.importKey(
            'raw',
            hashBuffer,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )

        return key
    }

    const encryptMessage = async (text: string, key: CryptoKey): Promise<string> => {
        const encoder = new TextEncoder()
        const data = encoder.encode(text)

        // Generate a random IV (initialization vector) for each message
        const iv = crypto.getRandomValues(new Uint8Array(12))

        // Encrypt the message
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        )

        // Combine IV and encrypted data, then encode as base64
        const combined = new Uint8Array(iv.length + encryptedData.byteLength)
        combined.set(iv)
        combined.set(new Uint8Array(encryptedData), iv.length)

        // Convert to base64 for transmission
        const binaryString = Array.from(combined, byte => String.fromCharCode(byte)).join('')
        return btoa(binaryString)
    }

    const decryptMessage = async (encryptedText: string, key: CryptoKey): Promise<string> => {
        try {
            // Decode from base64
            const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0))

            // Extract IV (first 12 bytes) and encrypted data (rest)
            const iv = combined.slice(0, 12)
            const encryptedData = combined.slice(12)

            // Decrypt
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedData
            )

            // Convert back to string
            const decoder = new TextDecoder()
            return decoder.decode(decryptedData)
        } catch (error) {
            console.error('❌ Decryption error:', error)
            // If decryption fails, return original (for backward compatibility)
            return encryptedText
        }
    }

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Sync remote video volume
    useEffect(() => {
        if (remoteVideoRef.current && hasRemoteStream) {
            remoteVideoRef.current.volume = remoteAudioVolume / 100
        }
    }, [remoteAudioVolume, hasRemoteStream])

    // AGGRESSIVE video monitoring and recovery - runs continuously
    useEffect(() => {
        if (!isMatched) return

        const checkVideo = () => {
            if (!remoteVideoRef.current) return

            const video = remoteVideoRef.current
            const stream = video.srcObject as MediaStream | null

            if (!stream) return

            // ALWAYS force visibility - never hide the video element
            video.style.opacity = '1'
            video.style.display = 'block'
            video.style.visibility = 'visible'
            video.style.zIndex = '15'

            // CRITICAL: If video has srcObject but is paused, try to play
            if (video.srcObject && video.paused) {
                video.play().catch(err => {
                    // Silently handle - will be caught by other handlers
                })
            }

            // Check video tracks status (only log errors, not every check)
            const videoTracks = stream.getVideoTracks()
            if (videoTracks.length > 0) {
                const track = videoTracks[0]

                // Only log if there's an actual problem (not muted - that's normal initially)
                if (track.readyState === 'ended') {
                    console.warn('🔄 Track ended - checking for new tracks...')
                }
                // Don't log muted state repeatedly - it's normal initially

                // Check video dimensions only if problematic
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    if (video.videoWidth <= 2 && video.videoHeight <= 2) {
                        // Video has no content - try to force play anyway
                        console.warn('⚠️ Video dimensions are 2x2 - attempting recovery...')
                        if (video.paused) {
                            video.play().catch(() => { })
                        }
                    } else {
                        // Video has real dimensions - mark as ready
                        setRemoteVideoReady(true)
                    }
                }
            }

            // ALWAYS try to play if paused (recovery mechanism)
            if (video.paused && stream.getVideoTracks().length > 0) {
                video.play().catch(() => {
                    // Silently handle - autoplay blocks are expected
                })
            }
        }

        // Check immediately
        checkVideo()

        // Check periodically for recovery (reduced frequency to reduce log spam)
        const interval = setInterval(checkVideo, 1000) // Check every 1 second (reduced from 200ms)
        return () => clearInterval(interval)
    }, [isMatched, remoteVideoReady])

    // Initialize WebRTC peer connection
    const createPeerConnection = (currentSocket: Socket | null, currentStrangerId: string | null) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                // STUN servers for NAT discovery (works for most same-network connections)
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                // Note: TURN servers removed due to timeout issues
                // For production, you'll need to set up your own TURN server
                // STUN-only should work for same-network connections
            ],
            iceTransportPolicy: 'all', // Try all connection types
        })

        // WebRTC Connection State Monitoring - ICE Candidates
        // Note: ICE candidate sending is handled in the socket effect, but we log here
        // The actual sending will be set up after socket is available

        // Enhanced ICE connection state logging
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState
            console.log('🧊 iceConnectionState =', state)
            if (state === 'failed' || state === 'disconnected') {
                console.error('❌ ICE connection failed/disconnected!')
                console.error('📊 Connection details:', {
                    iceConnectionState: pc.iceConnectionState,
                    connectionState: pc.connectionState,
                    signalingState: pc.signalingState,
                })
            } else if (state === 'connected') {
                console.log('✅✅✅ ICE CONNECTED! ✅✅✅')
            } else if (state === 'checking') {
                console.log('🔄 ICE connection checking...')
            } else if (state === 'completed') {
                console.log('✅ ICE connection completed!')
            } else if (state === 'new') {
                console.log('🆕 ICE connection state: new (waiting for candidates)')
            }
        }

        // Enhanced connection state logging
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState
            console.log('🔗 connectionState =', state)
            if (state === 'failed') {
                console.error('❌ WebRTC connection failed!')
                console.error('📊 Connection details:', {
                    iceConnectionState: pc.iceConnectionState,
                    connectionState: pc.connectionState,
                    signalingState: pc.signalingState,
                })
            } else if (state === 'connected') {
                console.log('✅✅✅ WebRTC CONNECTED! ✅✅✅')
            } else if (state === 'connecting') {
                console.log('🔄 WebRTC connecting...')
            } else if (state === 'new') {
                console.log('🆕 WebRTC connection state: new')
            }
        }

        // ICE candidate error logging
        pc.onicecandidateerror = (event: Event) => {
            const errorEvent = event as RTCPeerConnectionIceErrorEvent
            console.warn('🧊 ICE candidate error:', {
                address: errorEvent.address,
                port: errorEvent.port,
                url: errorEvent.url,
                errorCode: errorEvent.errorCode,
                errorText: errorEvent.errorText,
            })
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
                    console.error('❌❌❌ Remote video track ended! This means the remote peer stopped sending video!')
                    console.error('Track details:', {
                        id: videoTrack.id,
                        enabled: videoTrack.enabled,
                        readyState: videoTrack.readyState,
                        muted: videoTrack.muted
                    })
                    // Try to recover by checking if there are other tracks
                    if (event.streams[0]) {
                        const otherTracks = event.streams[0].getVideoTracks()
                        console.log('Other video tracks in stream:', otherTracks.length)
                        if (otherTracks.length > 0 && otherTracks[0] !== videoTrack) {
                            console.log('🔄 Trying to use another video track...')
                            // The stream will handle track replacement automatically
                        }
                    }
                }
                videoTrack.onmute = () => {
                    console.warn('⚠️⚠️⚠️ Remote video track muted! This means the remote peer muted their camera!')
                    console.warn('Track details:', {
                        id: videoTrack.id,
                        enabled: videoTrack.enabled,
                        readyState: videoTrack.readyState
                    })
                    // Check if this is a temporary mute or permanent
                    setTimeout(() => {
                        if (videoTrack.muted && remoteVideoRef.current) {
                            console.warn('⚠️ Track still muted after 2 seconds - remote peer may have disabled camera')
                            const width = remoteVideoRef.current.videoWidth || 0
                            const height = remoteVideoRef.current.videoHeight || 0
                            if (width <= 2 && height <= 2) {
                                console.error('❌ Video has no content - remote peer camera is not working!')
                            }
                        }
                    }, 2000)
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

                // Accept tracks even if muted initially - they may unmute
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

                // Log if track is muted but proceed anyway - it may unmute
                if (activeVideoTrack.muted) {
                    console.log('⚠️ Video track is muted initially - will wait for unmute')
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

                // Set stream (always - even if already set, in case it changed)
                console.log('Setting srcObject...')

                // CRITICAL: Make video visible FIRST before setting srcObject
                // Hidden elements can't load MediaStreams properly
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.style.display = 'block'
                    remoteVideoRef.current.style.opacity = '1'
                    remoteVideoRef.current.style.visibility = 'visible'
                    remoteVideoRef.current.style.zIndex = '15'
                    // Force video to be visible in the DOM
                    remoteVideoRef.current.hidden = false
                    console.log('✅ Made video visible BEFORE setting stream')
                }

                // ALWAYS set the stream (even if already set - stream might have changed)
                remoteVideoRef.current.srcObject = event.streams[0]
                
                // Force video to be visible after setting stream
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.style.display = 'block'
                    remoteVideoRef.current.style.visibility = 'visible'
                    remoteVideoRef.current.style.opacity = '1'
                }

                // CRITICAL: Update state immediately so opacity calculation works during render
                setHasRemoteStream(true)
                setRemoteVideoReady(true)

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

                            // Check WebRTC connection state
                            const pc = peerConnectionRef.current
                            if (pc) {
                                console.log('📊 WebRTC states:', {
                                    iceConnectionState: pc.iceConnectionState,
                                    connectionState: pc.connectionState,
                                    signalingState: pc.signalingState
                                })
                            }

                            // Wait a bit for video to load, then check dimensions
                            setTimeout(() => {
                                const width = remoteVideoRef.current?.videoWidth || 0
                                const height = remoteVideoRef.current?.videoHeight || 0
                                console.log('📐 Video dimensions after play:', width, 'x', height)

                                // CRITICAL: Check if video has actual dimensions
                                if (width <= 2 && height <= 2) {
                                    console.error('⚠️⚠️⚠️ VIDEO HAS NO CONTENT! Dimensions are only', width, 'x', height)
                                    console.error('This means the remote peer is not sending video data!')
                                    console.error('Possible causes:')
                                    console.error('1. Remote peer camera not working')
                                    console.error('2. Remote peer camera permission denied')
                                    console.error('3. WebRTC connection issue - check ICE/connection state above')
                                    console.error('4. Remote video track ended or muted')

                                    // Check connection state
                                    if (pc) {
                                        if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
                                            console.error('❌ ICE connection not established! State:', pc.iceConnectionState)
                                        }
                                        if (pc.connectionState !== 'connected') {
                                            console.error('❌ WebRTC connection not established! State:', pc.connectionState)
                                        }
                                    }
                                } else {
                                    console.log('✅✅✅ Video has content! Dimensions:', width, 'x', height)
                                }
                            }, 1000) // Wait 1 second for video to load

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
                    // Check connection state when video is waiting
                    const pc = peerConnectionRef.current
                    if (pc) {
                        console.warn('📊 Connection states while waiting:', {
                            iceConnectionState: pc.iceConnectionState,
                            connectionState: pc.connectionState,
                            videoWidth: remoteVideoRef.current?.videoWidth || 0,
                            videoHeight: remoteVideoRef.current?.videoHeight || 0
                        })
                    }
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
            }
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // Check if this is a relay candidate (TURN)
                const isRelay = event.candidate.candidate.includes('relay') ||
                    event.candidate.candidate.includes('typ relay')
                const candidateType = isRelay ? '🔄 RELAY (TURN)' : '📡 DIRECT/STUN'

                console.log(`🧊 ICE candidate generated (${candidateType}):`, {
                    candidate: event.candidate.candidate.substring(0, 80) + '...',
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    sdpMid: event.candidate.sdpMid,
                    type: isRelay ? 'relay' : 'host/srflx',
                })

                // Send ICE candidate if socket and strangerId are available
                // ALWAYS use refs to get current values (they're updated when match happens)
                const socketToUse = socketRef.current
                const strangerIdToUse = strangerIdRef.current

                if (socketToUse && strangerIdToUse) {
                    socketToUse.emit('webrtc-ice', {
                        candidate: event.candidate,
                        to: strangerIdToUse,
                    })
                    console.log('📤 Sent ICE candidate to stranger')
                } else {
                    // Queue candidate for later - will be sent when strangerId is set
                    pendingIceCandidatesRef.current.push(event.candidate)
                    console.log('📦 Queued ICE candidate (socket/strangerId not ready yet)')
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

            // Create peer connection - pass socket and strangerId for ICE candidate handling
            const pc = createPeerConnection(socketRef.current, null) // strangerId not available yet in startVideo

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

    // Audio control functions
    const toggleLocalAudio = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks()
            const newMutedState = !isLocalAudioMuted
            audioTracks.forEach(track => {
                track.enabled = !newMutedState
            })
            setIsLocalAudioMuted(newMutedState)
            console.log(newMutedState ? '🔇 Local audio muted' : '🔊 Local audio unmuted')
        }
    }

    const handleLocalVolumeChange = (volume: number) => {
        setLocalAudioVolume(volume)
        // Note: Browser doesn't allow direct control of microphone input volume
        // This is a UI indicator. Actual volume is controlled by system settings.
        // We can adjust the gain through Web Audio API if needed, but it's complex.
        console.log('Local audio volume set to:', volume + '%')
    }

    const handleRemoteVolumeChange = (volume: number) => {
        setRemoteAudioVolume(volume)
        if (remoteVideoRef.current) {
            remoteVideoRef.current.volume = volume / 100
            console.log('Remote audio volume set to:', volume + '%')
        }
    }

    // Camera toggle function
    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTracks = localStreamRef.current.getVideoTracks()
            const newCameraState = !isLocalCameraEnabled
            videoTracks.forEach(track => {
                track.enabled = newCameraState
            })
            setIsLocalCameraEnabled(newCameraState)
            console.log(newCameraState ? '📹 Camera enabled' : '📹 Camera disabled')
        }
    }

    // Report function
    const handleReport = () => {
        setShowReportModal(true)
    }

    const confirmReport = () => {
        if (socket && strangerId) {
            // In a real app, you'd send this to your backend for moderation
            console.log('🚨 Report submitted for user:', strangerId)
            // For now, just show a confirmation and disconnect
            alert('Thank you for reporting. The user has been reported and you will be disconnected.')
            disconnect()
        }
        setShowReportModal(false)
    }

    const cancelReport = () => {
        setShowReportModal(false)
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
            setHasRemoteStream(false) // Reset stream state
            setRemoteVideoReady(false) // Reset ready state
            // Reset audio states
            setIsLocalAudioMuted(false)
            setLocalAudioVolume(100)
            setRemoteAudioVolume(100)
            // Reset camera state
            setIsLocalCameraEnabled(true)
            stopVideo()
        })

        newSocket.on('matched', async (data: { strangerId: string }) => {
            console.log('✅ Matched with:', data.strangerId)
            setIsSearching(false)
            setIsMatched(true)
            setStrangerId(data.strangerId)
            strangerIdRef.current = data.strangerId // Update ref immediately

            // Generate shared encryption key for E2E encryption
            // Use deterministic order (smaller ID first) so both users get same key
            const sortedIds = [userId.current, data.strangerId].sort()
            encryptionKeyRef.current = await generateEncryptionKey(sortedIds[0], sortedIds[1])
            console.log('🔐 End-to-end encryption key generated')

            setMessages([{ id: uuidv4(), text: '🎥 Starting video...', sender: 'stranger' }])

            // ALWAYS start video for BOTH users - no matter who creates offer
            console.log('🎥 Starting camera...')
            // Update socket ref before creating peer connection
            socketRef.current = newSocket

            // Update peer connection's ICE candidate handler if it already exists
            if (peerConnectionRef.current) {
                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('🧊 ICE candidate generated (after match):', {
                            candidate: event.candidate.candidate.substring(0, 50) + '...',
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            sdpMid: event.candidate.sdpMid
                        })

                        if (newSocket && data.strangerId) {
                            newSocket.emit('webrtc-ice', {
                                candidate: event.candidate,
                                to: data.strangerId,
                            })
                            console.log('📤 Sent ICE candidate to stranger (after match)')
                        } else {
                            pendingIceCandidatesRef.current.push(event.candidate)
                        }
                    }
                }
            }

            const pc = await startVideo()

            if (!pc) {
                console.error('❌ Failed to start video')
                return
            }

            console.log('✅ Camera ready, peer connection:', !!pc)

            // CRITICAL: Don't apply queued ICE candidates here - wait for remote description to be set
            // They will be applied in the webrtc-offer handler after setRemoteDescription is called

            // CRITICAL: Update ICE candidate handler BEFORE creating offer
            // This ensures ICE candidates generated during offer creation are sent immediately
            if (peerConnectionRef.current) {
                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('🧊 ICE candidate generated (offer creator):', {
                            candidate: event.candidate.candidate.substring(0, 50) + '...',
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            sdpMid: event.candidate.sdpMid
                        })

                        const socketToUse = socketRef.current
                        const strangerIdToUse = strangerIdRef.current

                        if (socketToUse && strangerIdToUse) {
                            socketToUse.emit('webrtc-ice', {
                                candidate: event.candidate,
                                to: strangerIdToUse,
                            })
                            console.log('📤 Sent ICE candidate to stranger (offer creator)')
                        } else {
                            pendingIceCandidatesRef.current.push(event.candidate)
                            console.log('📦 Queued ICE candidate (offer creator)')
                        }
                    }
                }
            }

            // Wait a moment to ensure peer connection is fully set up
            await new Promise(resolve => setTimeout(resolve, 300))

            // CRITICAL: Send any queued ICE candidates now that we have strangerId and socket
            if (pendingIceCandidatesRef.current.length > 0) {
                console.log(`📤 Sending ${pendingIceCandidatesRef.current.length} queued ICE candidates`)
                pendingIceCandidatesRef.current.forEach(candidate => {
                    newSocket.emit('webrtc-ice', {
                        candidate: candidate,
                        to: data.strangerId,
                    })
                    console.log('📤 Sent queued ICE candidate')
                })
                pendingIceCandidatesRef.current = []
            }

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

            // Update strangerId ref if we're receiving an offer (we might not have been matched yet)
            if (!strangerIdRef.current) {
                strangerIdRef.current = data.from
                setStrangerId(data.from)
            }

            // Update ICE candidate handler to use current socket and strangerId
            if (peerConnectionRef.current) {
                peerConnectionRef.current.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('🧊 ICE candidate generated (in offer handler):', {
                            candidate: event.candidate.candidate.substring(0, 50) + '...',
                            sdpMLineIndex: event.candidate.sdpMLineIndex,
                            sdpMid: event.candidate.sdpMid
                        })

                        const socketToUse = socketRef.current
                        const strangerIdToUse = strangerIdRef.current

                        if (socketToUse && strangerIdToUse) {
                            socketToUse.emit('webrtc-ice', {
                                candidate: event.candidate,
                                to: strangerIdToUse,
                            })
                            console.log('📤 Sent ICE candidate to stranger (in offer handler)')
                        } else {
                            pendingIceCandidatesRef.current.push(event.candidate)
                            console.log('📦 Queued ICE candidate')
                        }
                    }
                }
            }

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

                    // CRITICAL: Apply any queued ICE candidates that arrived before remote description was set
                    // Must be done AFTER setRemoteDescription, otherwise we get InvalidStateError
                    if (pendingReceivedIceCandidatesRef.current.length > 0) {
                        console.log(`📥 Applying ${pendingReceivedIceCandidatesRef.current.length} queued received ICE candidates after setting remote description`)
                        // Wait a tiny bit to ensure remote description is fully set
                        await new Promise(resolve => setTimeout(resolve, 50))
                        for (const candidate of pendingReceivedIceCandidatesRef.current) {
                            try {
                                // Double-check that remote description is set
                                if (peerConnectionRef.current.remoteDescription) {
                                    await peerConnectionRef.current.addIceCandidate(candidate)
                                    console.log('✅ Applied queued received ICE candidate')
                                } else {
                                    console.warn('⚠️ Remote description not set yet, keeping candidate in queue')
                                }
                            } catch (error) {
                                console.error('❌ Error applying queued ICE candidate:', error)
                                // If it fails, keep it in queue - might be applied later
                            }
                        }
                        // Only clear if all were successfully applied
                        if (peerConnectionRef.current.remoteDescription) {
                            pendingReceivedIceCandidatesRef.current = []
                        }
                    }

                    // Send any queued ICE candidates now
                    if (pendingIceCandidatesRef.current.length > 0) {
                        console.log(`📤 Sending ${pendingIceCandidatesRef.current.length} queued ICE candidates`)
                        pendingIceCandidatesRef.current.forEach(candidate => {
                            newSocket.emit('webrtc-ice', {
                                candidate: candidate,
                                to: data.from,
                            })
                        })
                        pendingIceCandidatesRef.current = []
                    }
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

        newSocket.on('webrtc-ice', async (data: { candidate: RTCIceCandidateInit; from?: string }) => {
            console.log('🧊 Received ICE candidate from stranger', {
                from: data.from,
                hasCandidate: !!data.candidate,
                candidatePreview: data.candidate?.candidate?.substring(0, 50)
            })

            if (!data.candidate) {
                console.log('🧊 Received null ICE candidate (gathering complete signal)')
                return
            }

            if (peerConnectionRef.current) {
                try {
                    // Allow adding candidates even before remote description is set (they'll be queued)
                    await peerConnectionRef.current.addIceCandidate(data.candidate)
                    console.log('✅ Added ICE candidate to peer connection')

                    // Log connection state after adding candidate
                    setTimeout(() => {
                        const pc = peerConnectionRef.current
                        if (pc) {
                            console.log('📊 Connection state after adding candidate:', {
                                iceConnectionState: pc.iceConnectionState,
                                connectionState: pc.connectionState,
                                iceGatheringState: pc.iceGatheringState
                            })
                        }
                    }, 100)
                } catch (error) {
                    console.error('❌ Error adding ICE candidate:', error)
                    // If it fails because remoteDescription isn't set, queue it
                    if (error instanceof Error && error.name === 'InvalidStateError') {
                        console.warn('⚠️ Remote description not set yet, candidate will be queued by WebRTC')
                    }
                }
            } else {
                // Queue candidate for later - peer connection not ready yet
                console.log('📦 Queuing ICE candidate (peer connection not ready yet)')
                pendingReceivedIceCandidatesRef.current.push(data.candidate)
            }
        })

        newSocket.on('disconnected', () => {
            setIsMatched(false)
            setStrangerId(null)
            setHasRemoteStream(false) // Reset stream state
            setRemoteVideoReady(false) // Reset ready state
            // Reset audio states
            setIsLocalAudioMuted(false)
            setLocalAudioVolume(100)
            setRemoteAudioVolume(100)
            // Reset camera state
            setIsLocalCameraEnabled(true)
            stopVideo()
            setMessages([{ id: uuidv4(), text: 'Stranger disconnected', sender: 'stranger' }])
        })

        newSocket.on('message', async (data: { text: string; encrypted?: boolean }) => {
            // Decrypt message if encryption key is available
            let decryptedText = data.text
            if (encryptionKeyRef.current) {
                try {
                    decryptedText = await decryptMessage(data.text, encryptionKeyRef.current)
                    console.log('🔓 Decrypted message')
                } catch (error) {
                    console.error('❌ Failed to decrypt message:', error)
                    // Fallback: show encrypted text with indicator
                    decryptedText = '[Encrypted message - decryption failed]'
                }
            }
            setMessages((prev) => [...prev, { id: uuidv4(), text: decryptedText, sender: 'stranger' }])
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
            strangerIdRef.current = null // Reset ref
            setHasRemoteStream(false) // Reset stream state
            setRemoteVideoReady(false) // Reset ready state
            setMessages([])
            // Reset audio states
            setIsLocalAudioMuted(false)
            setLocalAudioVolume(100)
            setRemoteAudioVolume(100)
            // Reset camera state
            setIsLocalCameraEnabled(true)
            stopVideo()
        }
    }

    // Skip to next stranger (like Omegle)
    const skipStranger = () => {
        if (socket && strangerId) {
            // Disconnect from current stranger
            socket.emit('disconnect-stranger', { strangerId })
            setIsMatched(false)
            setStrangerId(null)
            strangerIdRef.current = null // Reset ref
            setHasRemoteStream(false) // Reset stream state
            setRemoteVideoReady(false) // Reset ready state
            setMessages([])
            // Reset audio states
            setIsLocalAudioMuted(false)
            setLocalAudioVolume(100)
            setRemoteAudioVolume(100)
            // Reset camera state
            setIsLocalCameraEnabled(true)
            stopVideo()
            
            // Automatically search for next stranger
            setTimeout(() => {
                setIsSearching(true)
                socket.emit('find-stranger', userId.current)
            }, 100) // Small delay to ensure cleanup completes
        }
    }

    const sendMessage = async () => {
        if (messageInput.trim() && socket && strangerId) {
            const messageText = messageInput.trim()

            // Encrypt message before sending (if encryption key is available)
            let messageToSend = messageText
            if (encryptionKeyRef.current) {
                try {
                    messageToSend = await encryptMessage(messageText, encryptionKeyRef.current)
                    console.log('🔐 Encrypted message before sending')
                } catch (error) {
                    console.error('❌ Failed to encrypt message:', error)
                    // Fallback: send unencrypted (shouldn't happen, but safety)
                    messageToSend = messageText
                }
            }

            // Show message immediately (will be decrypted on other end)
            setMessages((prev) => [...prev, { id: uuidv4(), text: messageText, sender: 'me' }])

            // Send encrypted message through server (server can't read it)
            socket.emit('send-message', {
                text: messageToSend,
                to: strangerId,
                encrypted: !!encryptionKeyRef.current
            })
            setMessageInput('')
        }
    }

    return (
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-yellow-50 via-white to-yellow-50'} ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Modern Header with Dark Mode Toggle */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        {/* Logo with Futuristic Effects */}
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400/20 via-yellow-500/30 to-yellow-400/20 blur-xl animate-pulse-slow"></div>
                            <img
                                src="/logo.png"
                                alt="Strangers Connect Logo"
                                className="h-12 w-12 object-contain rounded-2xl relative z-10 transition-all duration-300 hover:scale-110 hover:rotate-3 logo-glow"
                                style={{
                                    boxShadow: isDarkMode 
                                        ? '0 0 20px rgba(234, 179, 8, 0.4), 0 0 40px rgba(234, 179, 8, 0.2), inset 0 0 20px rgba(234, 179, 8, 0.1)'
                                        : '0 0 15px rgba(234, 179, 8, 0.3), 0 0 30px rgba(234, 179, 8, 0.15)'
                                }}
                                onError={(e) => {
                                    // Hide logo if file not found - no fallback emoji
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                }}
                            />
                        </div>
                        <div>
                            <h1 className={`text-2xl sm:text-3xl font-bold transition-all duration-300 ${isDarkMode ? 'text-white glow-yellow' : 'text-gray-900'}`}>Strangers Connect</h1>
                            <p className={`text-sm transition-all duration-300 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Connect • Chat • Video</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Report Button - Only show when matched */}
                        {isMatched && (
                            <button
                                onClick={handleReport}
                                className={`p-2.5 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 ${isDarkMode
                                    ? 'bg-red-600/80 hover:bg-red-500 text-white border border-red-500/50'
                                    : 'bg-red-500/80 hover:bg-red-400 text-white border border-red-400/50'
                                    } shadow-lg`}
                                title="Report inappropriate content"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </button>
                        )}

                        {/* Connection Status */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} ${isDarkMode ? 'border border-gray-700' : 'border border-gray-200'}`}>
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {isConnected ? 'Online' : 'Offline'}
                            </span>
                        </div>

                        {/* Dark Mode Toggle */}
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={`p-3 rounded-xl transition-all duration-300 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700' : 'bg-yellow-100 hover:bg-yellow-200 border border-yellow-300'}`}
                            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {isDarkMode ? (
                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Video Container - ALWAYS in DOM, never display:none (breaks MediaStream loading) */}
                {/* Mobile: Portrait (9/16), Desktop: Landscape (16/9) */}
                <div
                    className={`video-container mb-6 rounded-2xl relative cursor-pointer shadow-2xl overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-black border border-gray-800' : 'bg-black border border-gray-200'}`}
                    style={{
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
                    {/* Swaps between main view and PIP based on isLocalMain */}
                    <div
                        className={`absolute overflow-hidden transition-all duration-300 ease-in-out cursor-grab rounded-2xl ${isDarkMode ? 'border-2 border-white/20' : 'border-2 border-gray-300'} shadow-2xl`}
                        style={{
                            opacity: isMatched ? '1' : '0.01',
                            display: isMatched ? 'block' : 'none',
                            visibility: isMatched ? 'visible' : 'hidden',
                            // If isLocalMain is true, remote becomes PIP (small, bottom-right)
                            // If isLocalMain is false, remote is main (full screen)
                            width: isLocalMain ? '192px' : '100%',
                            height: isLocalMain ? '144px' : '100%',
                            top: isLocalMain ? 'auto' : '0',
                            left: isLocalMain ? 'auto' : '0',
                            right: isLocalMain ? '16px' : '0',
                            bottom: isLocalMain ? '16px' : '0',
                            zIndex: isLocalMain ? 20 : 15,
                            pointerEvents: isMatched ? 'auto' : 'none',
                            cursor: remoteVideoDragging ? 'grabbing' : 'grab'
                        }}
                        onClick={(e) => {
                            // Only swap if not dragging or zooming
                            if (!remoteVideoDragging && remoteVideoZoom === 1 && !remoteVideoLastTouch) {
                                if (isLocalMain) {
                                    setIsLocalMain(false)
                                }
                            }
                        }}
                        onWheel={(e) => {
                            // Scroll to zoom (like WhatsApp slide)
                            if (!isLocalMain) {
                                e.preventDefault()
                                const delta = e.deltaY > 0 ? -0.1 : 0.1
                                setRemoteVideoZoom(prev => {
                                    const newZoom = Math.max(1, Math.min(3, prev + delta))
                                    // Reset position if zooming back to 1
                                    if (newZoom === 1) {
                                        setRemoteVideoPosition({ x: 0, y: 0 })
                                    }
                                    return newZoom
                                })
                            }
                        }}
                        onMouseDown={(e) => {
                            if (remoteVideoZoom > 1 && !isLocalMain) {
                                setRemoteVideoDragging(true)
                                setRemoteVideoDragStart({
                                    x: e.clientX - remoteVideoPosition.x,
                                    y: e.clientY - remoteVideoPosition.y
                                })
                            }
                        }}
                        onMouseMove={(e) => {
                            if (remoteVideoDragging && remoteVideoZoom > 1) {
                                setRemoteVideoPosition({
                                    x: e.clientX - remoteVideoDragStart.x,
                                    y: e.clientY - remoteVideoDragStart.y
                                })
                            }
                        }}
                        onMouseUp={() => setRemoteVideoDragging(false)}
                        onMouseLeave={() => setRemoteVideoDragging(false)}
                        onTouchStart={(e) => {
                            if (e.touches.length === 1) {
                                // Single touch - start dragging if zoomed
                                if (remoteVideoZoom > 1 && !isLocalMain) {
                                    setRemoteVideoDragging(true)
                                    setRemoteVideoDragStart({
                                        x: e.touches[0].clientX - remoteVideoPosition.x,
                                        y: e.touches[0].clientY - remoteVideoPosition.y
                                    })
                                }
                            } else if (e.touches.length === 2) {
                                // Pinch gesture - calculate initial distance
                                const touch1 = e.touches[0]
                                const touch2 = e.touches[1]
                                const distance = Math.hypot(
                                    touch2.clientX - touch1.clientX,
                                    touch2.clientY - touch1.clientY
                                )
                                const center = {
                                    x: (touch1.clientX + touch2.clientX) / 2,
                                    y: (touch1.clientY + touch2.clientY) / 2
                                }
                                setRemoteVideoLastTouch({ distance, center })
                            }
                        }}
                        onTouchMove={(e) => {
                            if (e.touches.length === 1 && remoteVideoDragging && remoteVideoZoom > 1) {
                                // Single touch dragging
                                setRemoteVideoPosition({
                                    x: e.touches[0].clientX - remoteVideoDragStart.x,
                                    y: e.touches[0].clientY - remoteVideoDragStart.y
                                })
                            } else if (e.touches.length === 2 && remoteVideoLastTouch) {
                                // Pinch to zoom
                                e.preventDefault()
                                const touch1 = e.touches[0]
                                const touch2 = e.touches[1]
                                const distance = Math.hypot(
                                    touch2.clientX - touch1.clientX,
                                    touch2.clientY - touch1.clientY
                                )
                                const scale = distance / remoteVideoLastTouch.distance
                                setRemoteVideoZoom(prev => {
                                    const newZoom = Math.max(1, Math.min(3, prev * scale))
                                    if (newZoom === 1) {
                                        setRemoteVideoPosition({ x: 0, y: 0 })
                                    }
                                    return newZoom
                                })
                                setRemoteVideoLastTouch({ distance, center: remoteVideoLastTouch.center })
                            }
                        }}
                        onTouchEnd={(e) => {
                            if (e.touches.length < 2) {
                                setRemoteVideoLastTouch(null)
                            }
                            if (e.touches.length === 0) {
                                setRemoteVideoDragging(false)
                            }
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                transform: `scale(${remoteVideoZoom}) translate(${remoteVideoPosition.x / remoteVideoZoom}px, ${remoteVideoPosition.y / remoteVideoZoom}px)`,
                                transition: remoteVideoDragging || remoteVideoLastTouch ? 'none' : 'transform 0.2s ease-out',
                                transformOrigin: 'center center'
                            }}
                        >
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
                                    display: isMatched ? 'block' : 'none',
                                    pointerEvents: 'none',
                                    visibility: isMatched ? 'visible' : 'hidden',
                                    opacity: isMatched ? '1' : '0',
                                    objectFit: 'cover',
                                    objectPosition: 'center',
                                    zIndex: 10
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
                        </div>
                    </div>

                    {/* Play Button - Shown when autoplay is blocked */}
                    {showPlayButton && (
                        <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20 ${isDarkMode ? 'bg-black/80' : 'bg-black/70'}`}>
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
                                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-2xl hover:shadow-3xl transform hover:scale-105 active:scale-95 ${isDarkMode
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-yellow-500/50'
                                    : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black shadow-yellow-400/50'
                                    }`}
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
                            <div className={`absolute inset-0 flex items-center justify-center z-10 ${isDarkMode ? 'bg-gray-900/80' : 'bg-gray-100/80'} backdrop-blur-sm`}>
                                <div className="text-center">
                                    <div className={`text-6xl mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>👤</div>
                                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Waiting for stranger's video...</p>
                                </div>
                            </div>
                        )}

                    {/* Local Video - Swaps between main view and PIP based on isLocalMain */}
                    {isMatched && (
                        <div
                            className={`absolute overflow-hidden transition-all duration-300 ease-in-out cursor-grab rounded-2xl ${isDarkMode ? 'border-2 border-white/20' : 'border-2 border-gray-300'} shadow-2xl`}
                            style={{
                                // If isLocalMain is true, local is main (full screen)
                                // If isLocalMain is false, local is PIP (small, bottom-right)
                                width: isLocalMain ? '100%' : '192px',
                                height: isLocalMain ? '100%' : '144px',
                                top: isLocalMain ? '0' : 'auto',
                                left: isLocalMain ? '0' : 'auto',
                                right: isLocalMain ? '0' : '16px',
                                bottom: isLocalMain ? '0' : '16px',
                                zIndex: isLocalMain ? 15 : 20,
                                pointerEvents: 'auto',
                                cursor: localVideoDragging ? 'grabbing' : 'grab'
                            }}
                            onClick={(e) => {
                                // Only swap if not dragging or zooming
                                if (!localVideoDragging && localVideoZoom === 1 && !localVideoLastTouch) {
                                    if (!isLocalMain) {
                                        setIsLocalMain(true)
                                    }
                                }
                            }}
                            onWheel={(e) => {
                                // Scroll to zoom (like WhatsApp slide)
                                if (isLocalMain) {
                                    e.preventDefault()
                                    const delta = e.deltaY > 0 ? -0.1 : 0.1
                                    setLocalVideoZoom(prev => {
                                        const newZoom = Math.max(1, Math.min(3, prev + delta))
                                        // Reset position if zooming back to 1
                                        if (newZoom === 1) {
                                            setLocalVideoPosition({ x: 0, y: 0 })
                                        }
                                        return newZoom
                                    })
                                }
                            }}
                            onMouseDown={(e) => {
                                if (localVideoZoom > 1 && isLocalMain) {
                                    setLocalVideoDragging(true)
                                    setLocalVideoDragStart({
                                        x: e.clientX - localVideoPosition.x,
                                        y: e.clientY - localVideoPosition.y
                                    })
                                }
                            }}
                            onMouseMove={(e) => {
                                if (localVideoDragging && localVideoZoom > 1) {
                                    setLocalVideoPosition({
                                        x: e.clientX - localVideoDragStart.x,
                                        y: e.clientY - localVideoDragStart.y
                                    })
                                }
                            }}
                            onMouseUp={() => setLocalVideoDragging(false)}
                            onMouseLeave={() => setLocalVideoDragging(false)}
                            onTouchStart={(e) => {
                                if (e.touches.length === 1) {
                                    // Single touch - start dragging if zoomed
                                    if (localVideoZoom > 1 && isLocalMain) {
                                        setLocalVideoDragging(true)
                                        setLocalVideoDragStart({
                                            x: e.touches[0].clientX - localVideoPosition.x,
                                            y: e.touches[0].clientY - localVideoPosition.y
                                        })
                                    }
                                } else if (e.touches.length === 2) {
                                    // Pinch gesture - calculate initial distance
                                    const touch1 = e.touches[0]
                                    const touch2 = e.touches[1]
                                    const distance = Math.hypot(
                                        touch2.clientX - touch1.clientX,
                                        touch2.clientY - touch1.clientY
                                    )
                                    const center = {
                                        x: (touch1.clientX + touch2.clientX) / 2,
                                        y: (touch1.clientY + touch2.clientY) / 2
                                    }
                                    setLocalVideoLastTouch({ distance, center })
                                }
                            }}
                            onTouchMove={(e) => {
                                if (e.touches.length === 1 && localVideoDragging && localVideoZoom > 1) {
                                    // Single touch dragging
                                    setLocalVideoPosition({
                                        x: e.touches[0].clientX - localVideoDragStart.x,
                                        y: e.touches[0].clientY - localVideoDragStart.y
                                    })
                                } else if (e.touches.length === 2 && localVideoLastTouch) {
                                    // Pinch to zoom
                                    e.preventDefault()
                                    const touch1 = e.touches[0]
                                    const touch2 = e.touches[1]
                                    const distance = Math.hypot(
                                        touch2.clientX - touch1.clientX,
                                        touch2.clientY - touch1.clientY
                                    )
                                    const scale = distance / localVideoLastTouch.distance
                                    setLocalVideoZoom(prev => {
                                        const newZoom = Math.max(1, Math.min(3, prev * scale))
                                        if (newZoom === 1) {
                                            setLocalVideoPosition({ x: 0, y: 0 })
                                        }
                                        return newZoom
                                    })
                                    setLocalVideoLastTouch({ distance, center: localVideoLastTouch.center })
                                }
                            }}
                            onTouchEnd={(e) => {
                                if (e.touches.length < 2) {
                                    setLocalVideoLastTouch(null)
                                }
                                if (e.touches.length === 0) {
                                    setLocalVideoDragging(false)
                                }
                            }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    transform: `scale(${localVideoZoom}) translate(${localVideoPosition.x / localVideoZoom}px, ${localVideoPosition.y / localVideoZoom}px)`,
                                    transition: localVideoDragging || localVideoLastTouch ? 'none' : 'transform 0.2s ease-out',
                                    transformOrigin: 'center center'
                                }}
                            >
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{
                                        transform: 'scaleX(-1)',
                                        display: 'block',
                                        pointerEvents: 'none',
                                        objectFit: 'cover',
                                        objectPosition: 'center'
                                    }}
                                />
                            </div>
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
                                    <div className={`px-3 py-1 rounded-lg text-sm ${msg.sender === 'me' ? 'bg-yellow-500 text-black' : 'bg-gray-700'
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
                            <button onClick={sendMessage} className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600 font-semibold transition-all">
                                Send
                            </button>
                        </div>
                    </div>
                )}

                {/* Homepage - Modern & Stylish */}
                {!isMatched && !isSearching && (
                    <div className="text-center py-12 sm:py-20">
                        <div className={`inline-block p-6 rounded-3xl mb-8 ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'} backdrop-blur-sm border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} shadow-2xl`}>
                            {/* Logo on Homepage with Futuristic Effects */}
                            <div className="mb-6 flex justify-center relative">
                                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-400/30 via-yellow-500/40 to-yellow-400/30 blur-2xl animate-pulse-slow"></div>
                                <img
                                    src="/logo.png"
                                    alt="Strangers Connect"
                                    className="h-32 w-32 object-contain rounded-3xl relative z-10 transition-all duration-500 hover:scale-110 hover:rotate-6 logo-glow-homepage"
                                    style={{
                                        boxShadow: isDarkMode 
                                            ? '0 0 40px rgba(234, 179, 8, 0.5), 0 0 80px rgba(234, 179, 8, 0.3), inset 0 0 40px rgba(234, 179, 8, 0.15)'
                                            : '0 0 30px rgba(234, 179, 8, 0.4), 0 0 60px rgba(234, 179, 8, 0.2)'
                                    }}
                                    onError={(e) => {
                                        // Hide logo if file not found - no fallback emoji
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                    }}
                                />
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold mb-3 transition-all duration-300 ${isDarkMode ? 'text-white glow-yellow' : 'text-gray-900'}`}>
                                Connect with Strangers
                            </h2>
                            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-8 max-w-md mx-auto`}>
                                Meet new people from around the world. Video chat, text messages, and end-to-end encryption.
                            </p>
                            <button
                                onClick={findStranger}
                                disabled={!isConnected}
                                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed futuristic-button relative overflow-hidden ${isConnected
                                    ? isDarkMode
                                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-yellow-500/50'
                                        : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-black shadow-yellow-400/50'
                                    : `${isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'}`
                                    }`}
                                style={isConnected ? {
                                    boxShadow: isDarkMode
                                        ? '0 0 20px rgba(234, 179, 8, 0.5), 0 0 40px rgba(234, 179, 8, 0.3), inset 0 0 20px rgba(234, 179, 8, 0.1)'
                                        : '0 0 15px rgba(234, 179, 8, 0.4), 0 0 30px rgba(234, 179, 8, 0.2)'
                                } : {}}
                            >
                                <span className="relative z-10">{isConnected ? '🎯 Find Stranger' : 'Connecting...'}</span>
                            </button>
                        </div>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 max-w-4xl mx-auto">
                            <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/50 border border-gray-200'} backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-yellow-500/50 animate-float`} style={{ animationDelay: '0s' }}>
                                <div className="text-4xl mb-3 transition-transform duration-300 hover:scale-110">🔒</div>
                                <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>End-to-End Encrypted</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your messages are private</p>
                            </div>
                            <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/50 border border-gray-200'} backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-yellow-500/50 animate-float`} style={{ animationDelay: '1s' }}>
                                <div className="text-4xl mb-3 transition-transform duration-300 hover:scale-110">🎥</div>
                                <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>HD Video Chat</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Crystal clear video calls</p>
                            </div>
                            <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white/50 border border-gray-200'} backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-yellow-500/50 animate-float`} style={{ animationDelay: '2s' }}>
                                <div className="text-4xl mb-3 transition-transform duration-300 hover:scale-110">🌍</div>
                                <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Global Reach</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Connect worldwide</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="flex flex-col items-center gap-4">
                    {isSearching && (
                        <div className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold ${isDarkMode ? 'bg-gray-800/80 border border-gray-700' : 'bg-white/80 border border-yellow-200'} backdrop-blur-sm shadow-lg`}>
                            <div className={`w-5 h-5 border-2 ${isDarkMode ? 'border-yellow-500' : 'border-yellow-400'} border-t-transparent rounded-full animate-spin`}></div>
                            <span className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>Searching for stranger...</span>
                        </div>
                    )}

                    {isMatched && (
                        <>
                            {/* Audio & Camera Controls */}
                            <div className={`flex flex-col sm:flex-row items-center gap-4 px-6 py-4 rounded-xl ${isDarkMode ? 'bg-gray-800/80 border border-gray-700' : 'bg-white/80 border border-gray-200'} backdrop-blur-sm shadow-lg`}>
                                {/* Camera Toggle */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={toggleCamera}
                                        className={`p-3 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${isLocalCameraEnabled
                                            ? isDarkMode ? 'bg-blue-600/80 hover:bg-blue-500 text-white' : 'bg-blue-500/80 hover:bg-blue-400 text-white'
                                            : isDarkMode ? 'bg-gray-600/80 hover:bg-gray-500 text-white' : 'bg-gray-400/80 hover:bg-gray-300 text-white'
                                            }`}
                                        title={isLocalCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                                    >
                                        {isLocalCameraEnabled ? '📹' : '📷'}
                                    </button>
                                </div>

                                {/* Local Audio Controls */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={toggleLocalAudio}
                                        className={`p-3 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 ${isLocalAudioMuted
                                            ? isDarkMode ? 'bg-red-600/80 hover:bg-red-500 text-white' : 'bg-red-500/80 hover:bg-red-400 text-white'
                                            : isDarkMode ? 'bg-green-600/80 hover:bg-green-500 text-white' : 'bg-green-500/80 hover:bg-green-400 text-white'
                                            }`}
                                        title={isLocalAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                                    >
                                        {isLocalAudioMuted ? '🔇' : '🎤'}
                                    </button>
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Mic:</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={localAudioVolume}
                                            onChange={(e) => handleLocalVolumeChange(Number(e.target.value))}
                                            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                                background: isDarkMode
                                                    ? `linear-gradient(to right, #10b981 0%, #10b981 ${localAudioVolume}%, #374151 ${localAudioVolume}%, #374151 100%)`
                                                    : `linear-gradient(to right, #059669 0%, #059669 ${localAudioVolume}%, #d1d5db ${localAudioVolume}%, #d1d5db 100%)`
                                            }}
                                        />
                                        <span className={`text-xs w-10 text-right ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{localAudioVolume}%</span>
                                    </div>
                                </div>

                                {/* Remote Audio Controls */}
                                <div className="flex items-center gap-3">
                                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-200/50 text-gray-500'}`} title="Remote audio (you can only adjust volume)">
                                        🔊
                                    </div>
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Speaker:</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={remoteAudioVolume}
                                            onChange={(e) => handleRemoteVolumeChange(Number(e.target.value))}
                                            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                                background: isDarkMode
                                                    ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${remoteAudioVolume}%, #374151 ${remoteAudioVolume}%, #374151 100%)`
                                                    : `linear-gradient(to right, #2563eb 0%, #2563eb ${remoteAudioVolume}%, #d1d5db ${remoteAudioVolume}%, #d1d5db 100%)`
                                            }}
                                        />
                                        <span className={`text-xs w-10 text-right ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{remoteAudioVolume}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Call Control Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                {/* Next Stranger Button (Skip) */}
                                <button
                                    onClick={skipStranger}
                                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${isDarkMode
                                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
                                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white'
                                        }`}
                                >
                                    <span>⏭️</span>
                                    <span>Next Stranger</span>
                                </button>

                                {/* End Call Button */}
                                <button
                                    onClick={disconnect}
                                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${isDarkMode
                                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white'
                                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white'
                                        }`}
                                >
                                    <span>📞</span>
                                    <span>End Call</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Report Modal */}
                {showReportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className={`max-w-md w-full rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-3 rounded-full ${isDarkMode ? 'bg-red-600/20' : 'bg-red-100'}`}>
                                        <svg className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        Report User
                                    </h3>
                                </div>
                                <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Are you sure you want to report this user for inappropriate content? This action will disconnect you from the current call.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={cancelReport}
                                        className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${isDarkMode
                                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmReport}
                                        className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 ${isDarkMode
                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                            : 'bg-red-500 hover:bg-red-400 text-white'
                                            }`}
                                    >
                                        Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className={`mt-12 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    <p className="text-sm">
                        © 2024 Vamsi Krishna •{' '}
                        <a
                            href="https://github.com/vamsikrishnakosuri/StrangersConnect"
                            className={`hover:underline transition-all ${isDarkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-yellow-600 hover:text-yellow-700'}`}
                        >
                            Open Source
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
