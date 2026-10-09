'use client'

import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { Signal, deviceId } from '@/lib/signal'
import { v4 as uuidv4 } from 'uuid'
import Landing from '@/components/Landing'
import { SearchRings } from '@/components/Illustrations'
import { LogoMark } from '@/components/Logo'

interface Message {
    id: string
    text: string
    sender: 'me' | 'stranger' | 'system'
}

export default function Home() {
    const [socket, setSocket] = useState<Signal | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [isMatched, setIsMatched] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [messageInput, setMessageInput] = useState('')
    const [strangerId, setStrangerId] = useState<string | null>(null)
    const [remoteVideoReady, setRemoteVideoReady] = useState(false)
    const [hasRemoteStream, setHasRemoteStream] = useState(false) // Track when srcObject is set
    const [showPlayButton, setShowPlayButton] = useState(false)

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
    // 18+ confirmation, asked once per browser before the first match
    const [showAgeGate, setShowAgeGate] = useState(false)

    // "Meet this person again?" The answer only ever narrows matching; silence means yes
    const [lastPeer, setLastPeer] = useState<string | null>(null)
    const [rematchAnswer, setRematchAnswer] = useState<'yes' | 'no' | null>(null)
    const [strangerTyping, setStrangerTyping] = useState(false)
    const typingSentRef = useRef(0)

    const userId = useRef(uuidv4())
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const encryptionKeyRef = useRef<CryptoKey | null>(null) // AES-GCM key derived via ECDH, never leaves this browser
    const keyPairPromiseRef = useRef<Promise<CryptoKeyPair> | null>(null) // Ephemeral ECDH key pair for the current match
    const myPublicKeyRef = useRef<string | null>(null)
    const peerPublicKeyRef = useRef<string | null>(null)
    const [chatReady, setChatReady] = useState(false)
    const [safetyCode, setSafetyCode] = useState<string | null>(null)
    const [callEnded, setCallEnded] = useState<string | null>(null) // Shown after a call ends
    const [notice, setNotice] = useState<string | null>(null) // Small toast, e.g. report confirmation
    const pendingIceCandidatesRef = useRef<RTCIceCandidate[]>([]) // Queue ICE candidates until strangerId is ready
    const pendingReceivedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]) // Queue ICE candidates received before peer connection is ready
    const socketRef = useRef<Signal | null>(null) // Ref to access current socket in ICE candidate handler
    const strangerIdRef = useRef<string | null>(null) // Ref to access current strangerId in ICE candidate handler

    // End-to-end encrypted chat (Web Crypto API, built into every browser, free)
    // Each match creates a fresh ECDH P-256 key pair. Only the public halves cross the
    // server, so the server cannot derive the AES key and cannot read messages.
    const toB64 = (buf: ArrayBuffer | Uint8Array) => {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
        return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
    }
    const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
    const encoder = new TextEncoder()

    const startKeyExchange = (): Promise<CryptoKeyPair> => {
        // Private key is non-extractable: it cannot leave this tab even via script
        const pair = crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) as Promise<CryptoKeyPair>
        keyPairPromiseRef.current = pair
        return pair
    }

    const completeKeyExchange = async (peerPublicKeyB64: string) => {
        const pair = await keyPairPromiseRef.current
        if (!pair) return
        const myPub = toB64(await crypto.subtle.exportKey('raw', pair.publicKey))
        const peerKey = await crypto.subtle.importKey('raw', fromB64(peerPublicKeyB64), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
        const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey }, pair.privateKey, 256)

        // HKDF turns the raw shared secret into a proper AES key, bound to both public keys
        const salt = await crypto.subtle.digest('SHA-256', encoder.encode([myPub, peerPublicKeyB64].sort().join('|')))
        const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
        encryptionKeyRef.current = await crypto.subtle.deriveKey(
            { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('strangers-connect chat v1') },
            hkdfKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
        myPublicKeyRef.current = myPub
        peerPublicKeyRef.current = peerPublicKeyB64
        setChatReady(true)
    }

    // Short code both people can read aloud. It covers the chat keys and the DTLS
    // fingerprints of the video call, so a man-in-the-middle would make the codes differ.
    const computeSafetyCode = async (): Promise<string | null> => {
        const pc = peerConnectionRef.current
        const fingerprint = (sdp?: string) => sdp?.match(/a=fingerprint:\S+ (\S+)/)?.[1]
        const local = fingerprint(pc?.localDescription?.sdp)
        const remote = fingerprint(pc?.remoteDescription?.sdp)
        if (!local || !remote || !myPublicKeyRef.current || !peerPublicKeyRef.current) return null
        const material = [local, remote, myPublicKeyRef.current, peerPublicKeyRef.current].sort().join('|')
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(material)))
        const n = ((hash[0] << 16) | (hash[1] << 8) | hash[2]) % 1000000
        const s = n.toString().padStart(6, '0')
        return `${s.slice(0, 3)} ${s.slice(3)}`
    }

    const resetEncryption = () => {
        encryptionKeyRef.current = null
        keyPairPromiseRef.current = null
        myPublicKeyRef.current = null
        peerPublicKeyRef.current = null
        setChatReady(false)
        setSafetyCode(null)
    }

    const encryptMessage = async (text: string, key: CryptoKey): Promise<string> => {
        const iv = crypto.getRandomValues(new Uint8Array(12)) // fresh IV per message
        const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))
        const combined = new Uint8Array(iv.length + encryptedData.byteLength)
        combined.set(iv)
        combined.set(new Uint8Array(encryptedData), iv.length)
        return toB64(combined)
    }

    // Throws if the message was tampered with or not encrypted with our shared key
    const decryptMessage = async (encryptedText: string, key: CryptoKey): Promise<string> => {
        const combined = fromB64(encryptedText)
        const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12))
        return new TextDecoder().decode(decryptedData)
    }

    // Safety code becomes available once both keys and both SDPs are in place
    useEffect(() => {
        if (!isMatched || !chatReady) return
        let cancelled = false
        const tick = async () => {
            const code = await computeSafetyCode()
            if (code && !cancelled) {
                setSafetyCode(code)
                clearInterval(id)
            }
        }
        const id = setInterval(tick, 1000)
        tick()
        return () => {
            cancelled = true
            clearInterval(id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMatched, chatReady])

    useEffect(() => {
        if (!notice) return
        const t = setTimeout(() => setNotice(null), 4500)
        return () => clearTimeout(t)
    }, [notice])

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
    const createPeerConnection = (currentSocket: Signal | null, currentStrangerId: string | null) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                // STUN servers for NAT discovery (works for most same-network connections)
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                // Optional free TURN relay (e.g. Cloudflare Realtime or Metered) for users behind strict NATs.
                // TURN only forwards already-encrypted SRTP packets; it cannot see the video.
                ...(process.env.NEXT_PUBLIC_TURN_URLS
                    ? [{
                        urls: process.env.NEXT_PUBLIC_TURN_URLS.split(','),
                        username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
                    }]
                    : []),
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
            // Send report to server
            socket.emit('report-user', {
                reportedUserId: strangerId,
                reason: 'Inappropriate content'
            })
            // Disconnect after reporting; the server also stops you being matched again
            disconnect()
            setRematchAnswer('no')
        }
        setShowReportModal(false)
    }

    const cancelReport = () => {
        setShowReportModal(false)
    }

    // Socket.io connection
    useEffect(() => {
        const newSocket = new Signal(process.env.NEXT_PUBLIC_SIGNAL_URL || 'ws://localhost:8787/ws')

        newSocket.on('connect', () => {
            console.log('✅ Connected')
            setIsConnected(true)
            newSocket.emit('register', { userId: userId.current, deviceId: deviceId() })
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

            // Fresh ECDH key pair for this match; only the public half goes through the server
            window.scrollTo({ top: 0, behavior: 'smooth' })
            setCallEnded(null)
            resetEncryption()
            const keyPair = await startKeyExchange()
            newSocket.emit('key-exchange', {
                publicKey: toB64(await crypto.subtle.exportKey('raw', keyPair.publicKey)),
                to: data.strangerId,
            })

            setMessages([])

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

        newSocket.on('banned', (data: { reason: string; reportCount?: number }) => {
            console.error('🚫 You have been banned:', data.reason)
            setIsConnected(false)
            setIsMatched(false)
            setIsSearching(false)
            stopVideo()
            resetEncryption()
            setCallEnded(data.reason)
            if (newSocket) {
                newSocket.disconnect()
            }
        })

        newSocket.on('report-confirmed', (data: { message: string; reportCount?: number; threshold?: number }) => {
            setNotice(data.message)
        })

        newSocket.on('disconnected', () => {
            setIsMatched(false)
            setLastPeer(strangerIdRef.current)
            setRematchAnswer(null)
            setStrangerTyping(false)
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
            resetEncryption()
            setMessages([])
            setCallEnded('The other person left the conversation.')
        })

        newSocket.on('key-exchange', async (data: { publicKey: string; from: string }) => {
            if (data.from !== strangerIdRef.current) return
            try {
                await completeKeyExchange(data.publicKey)
            } catch (error) {
                console.error('Key exchange failed:', error)
            }
        })

        let typingTimer: ReturnType<typeof setTimeout> | null = null
        newSocket.on('typing', (data: { from: string; on: boolean }) => {
            if (data.from !== strangerIdRef.current) return
            setStrangerTyping(data.on)
            if (typingTimer) clearTimeout(typingTimer)
            typingTimer = setTimeout(() => setStrangerTyping(false), 3500)
        })

        newSocket.on('message', async (data: { text: string; encrypted?: boolean; from?: string }) => {
            setStrangerTyping(false)
            // Only show messages that the stranger's browser encrypted with our shared key
            if (!data.encrypted || !encryptionKeyRef.current || data.from !== strangerIdRef.current) return
            try {
                const text = await decryptMessage(data.text, encryptionKeyRef.current)
                setMessages((prev) => [...prev, { id: uuidv4(), text, sender: 'stranger' }])
            } catch {
                setMessages((prev) => [...prev, { id: uuidv4(), text: 'A message failed verification and was hidden.', sender: 'system' }])
            }
        })

        setSocket(newSocket)

        return () => {
            stopVideo()
            newSocket.close()
        }
    }, [])

    const hasAgreed = () => {
        try {
            return localStorage.getItem('sc-agreed-v1') === 'yes'
        } catch {
            return false
        }
    }

    // Every Start button goes through here so nobody is matched before confirming 18+
    const requestStart = () => {
        if (hasAgreed()) findStranger()
        else setShowAgeGate(true)
    }

    const acceptRules = () => {
        try {
            localStorage.setItem('sc-agreed-v1', 'yes')
        } catch {
            // private mode: we ask again next visit
        }
        setShowAgeGate(false)
        findStranger()
    }

    const findStranger = () => {
        if (socket) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            setCallEnded(null)
            setIsSearching(true)
            socket.emit('find-stranger')
        }
    }

    const disconnect = () => {
        if (socket && strangerId) {
            socket.emit('disconnect-stranger', { strangerId })
            setIsMatched(false)
            setLastPeer(strangerIdRef.current)
            setRematchAnswer(null)
            setStrangerTyping(false)
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
            resetEncryption()
            setCallEnded('You ended the conversation.')
        }
    }

    // Skip to next stranger (like Omegle)
    const skipStranger = () => {
        if (socket && strangerId) {
            // Disconnect from current stranger
            socket.emit('disconnect-stranger', { strangerId })
            setIsMatched(false)
            setLastPeer(strangerIdRef.current)
            setRematchAnswer(null)
            setStrangerTyping(false)
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
            resetEncryption()

            // Automatically search for next stranger
            setTimeout(() => {
                setIsSearching(true)
                socket.emit('find-stranger')
            }, 100) // Small delay to ensure cleanup completes
        }
    }

    const answerRematch = (answer: 'yes' | 'no') => {
        setRematchAnswer(answer)
        if (answer === 'no' && socket && lastPeer) socket.emit('avoid', { peerId: lastPeer })
    }

    const cancelSearch = () => {
        socket?.emit('cancel-search')
        setIsSearching(false)
    }

    // Tell the stranger we are typing, at most once every 2 seconds
    const onType = (value: string) => {
        setMessageInput(value)
        const now = Date.now()
        if (socket && strangerId && value && now - typingSentRef.current > 2000) {
            typingSentRef.current = now
            socket.emit('typing', { to: strangerId, on: true })
        }
    }

    const sendMessage = async (preset?: string) => {
        const messageText = (preset ?? messageInput).trim()
        // Never send plaintext: wait until the key exchange has finished
        if (!messageText || !socket || !strangerId || !encryptionKeyRef.current) return
        try {
            const ciphertext = await encryptMessage(messageText, encryptionKeyRef.current)
            setMessages((prev) => [...prev, { id: uuidv4(), text: messageText, sender: 'me' }])
            socket.emit('send-message', { text: ciphertext, to: strangerId, encrypted: true })
            setMessageInput('')
            typingSentRef.current = 0
        } catch (error) {
            console.error('Failed to encrypt message:', error)
        }
    }

    const idle = !isMatched && !isSearching

    return (
        <div className="grain relative min-h-screen bg-ink-900 text-paper">
            {/* Floating pill nav */}
            <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3">
                <nav className="mx-auto max-w-page flex items-center justify-between gap-3 rounded-full border border-paper/10 bg-ink-900/70 backdrop-blur-xl pl-3 sm:pl-4 pr-2 py-2">
                    <a href="/" className="flex items-center gap-2.5 min-w-0" aria-label="Strangers Connect home">
                        <LogoMark className="h-8 w-8 shrink-0" />
                        <span className="font-serif text-[22px] leading-none tracking-tight truncate">Strangers Connect</span>
                    </a>

                    {idle && !callEnded && (
                        <div className="hidden md:flex items-center gap-7 text-sm text-paper-mute">
                            <a href="#how" className="hover:text-paper transition-colors">How it works</a>
                            <a href="#privacy" className="hover:text-paper transition-colors">Privacy</a>
                            <a href="#faq" className="hover:text-paper transition-colors">FAQ</a>
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                        {isMatched && (
                            <button onClick={handleReport} className="btn-ghost px-3.5 py-2 text-sm text-danger border-danger/30 hover:border-danger/60" title="Report inappropriate behavior">
                                <Icon name="flag" /> <span className="hidden sm:inline">Report</span>
                            </button>
                        )}
                        {idle && (
                            <button onClick={requestStart} disabled={!isConnected} className="btn-primary px-4 py-2 text-sm">
                                Start
                            </button>
                        )}
                    </div>
                </nav>
            </header>

            {/* Call area. The video container stays mounted at all times (MediaStreams need it). */}
            <div className={isMatched ? 'mx-auto max-w-page px-4 sm:px-6 pt-6 pb-10 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 relative z-10' : 'relative z-10'}>
                <div className="flex flex-col gap-4 min-w-0">
                    <div className="relative">
                        <div
                    className={`video-container rounded-3xl relative cursor-pointer overflow-hidden transition-all duration-300 bg-black border border-paper/10`}
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
                        className={`absolute overflow-hidden transition-all duration-300 ease-in-out cursor-grab rounded-2xl border border-paper/20 shadow-2xl`}
                        style={{
                            opacity: isMatched ? '1' : '0.01',
                            display: isMatched ? 'block' : 'none',
                            visibility: isMatched ? 'visible' : 'hidden',
                            // If isLocalMain is true, remote becomes PIP (small, bottom-right)
                            // If isLocalMain is false, remote is main (full screen)
                            width: isLocalMain ? 'var(--pip-w)' : '100%',
                            height: isLocalMain ? 'var(--pip-h)' : '100%',
                            top: isLocalMain ? '14px' : '0',
                            left: isLocalMain ? 'auto' : '0',
                            right: isLocalMain ? '14px' : '0',
                            bottom: isLocalMain ? 'auto' : '0',
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
                        <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20 bg-black/80`}>
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
                                className="btn-primary px-7 py-3.5 text-[15px]"
                            >
                                Tap to see your stranger
                            </button>
                        </div>
                    )}

                    {/* Placeholder - Only show if video has no srcObject */}
                    {(() => {
                        const hasSrcObject = remoteVideoRef.current?.srcObject !== null && remoteVideoRef.current?.srcObject !== undefined
                        return !hasSrcObject && !remoteVideoReady && isMatched
                    })() && (
                            <div className={`absolute inset-0 flex items-center justify-center z-10 bg-ink-900/90 backdrop-blur-sm`}>
                                <div className="text-center">
                                    <div className="mx-auto mb-4 flex justify-center"><SearchRings /></div>
                                    <p className="text-paper-dim text-sm">Connecting video…</p>
                                </div>
                            </div>
                        )}

                    {/* Local Video - Swaps between main view and PIP based on isLocalMain */}
                    {isMatched && (
                        <div
                            className={`absolute overflow-hidden transition-all duration-300 ease-in-out cursor-grab rounded-2xl border border-paper/20 shadow-2xl`}
                            style={{
                                // If isLocalMain is true, local is main (full screen)
                                // If isLocalMain is false, local is PIP (small, bottom-right)
                                width: isLocalMain ? '100%' : 'var(--pip-w)',
                                height: isLocalMain ? '100%' : 'var(--pip-h)',
                                top: isLocalMain ? '0' : '14px',
                                left: isLocalMain ? '0' : 'auto',
                                right: isLocalMain ? '0' : '14px',
                                bottom: isLocalMain ? '0' : 'auto',
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
                        {isMatched && (
                            <div className="pointer-events-none absolute left-3.5 top-3.5 z-30 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md px-3 py-1.5 font-mono text-[10.5px] text-paper-dim animate-fade-in">
                                <span className="h-1.5 w-1.5 rounded-full bg-glow breathe" />
                                <span className="hidden sm:inline">live · peer-to-peer · </span>encrypted
                            </div>
                        )}

                        {isMatched && (
                            <div className="absolute inset-x-0 bottom-3 sm:bottom-5 z-30 flex flex-col items-center gap-2 px-3 dock-in">
                                {showAudioControls && (
                                    <div className="w-full max-w-sm rounded-2xl border border-paper/10 bg-ink-900/75 backdrop-blur-xl p-4 space-y-3 animate-fade-in">
                                        {[
                                            { label: 'Your mic', value: localAudioVolume, onChange: handleLocalVolumeChange },
                                            { label: 'Their voice', value: remoteAudioVolume, onChange: handleRemoteVolumeChange },
                                        ].map((v) => (
                                            <label key={v.label} className="flex items-center gap-3 font-mono text-[11px] text-paper-mute">
                                                <span className="w-20 shrink-0">{v.label}</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={v.value}
                                                    onChange={(e) => v.onChange(Number(e.target.value))}
                                                    className="flex-1 h-1 rounded-full"
                                                    style={{ background: `linear-gradient(to right, #ece9e2 ${v.value}%, rgba(236,233,226,0.15) ${v.value}%)` }}
                                                />
                                                <span className="w-9 text-right">{v.value}%</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-paper/10 bg-ink-900/60 backdrop-blur-xl p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
                                    <DockButton label={isLocalAudioMuted ? 'Unmute' : 'Mute'} active={isLocalAudioMuted} onClick={toggleLocalAudio}>
                                        <Icon name={isLocalAudioMuted ? 'micOff' : 'mic'} />
                                    </DockButton>
                                    <DockButton label={isLocalCameraEnabled ? 'Camera off' : 'Camera on'} active={!isLocalCameraEnabled} onClick={toggleCamera}>
                                        <Icon name={isLocalCameraEnabled ? 'cam' : 'camOff'} />
                                    </DockButton>
                                    <DockButton label="Volume" pressed={showAudioControls} onClick={() => setShowAudioControls(!showAudioControls)}>
                                        <Icon name="speaker" />
                                    </DockButton>
                                    <span className="mx-0.5 h-6 w-px bg-paper/15" aria-hidden="true" />
                                    <button
                                        onClick={disconnect}
                                        title="End conversation"
                                        aria-label="End conversation"
                                        className="group h-11 w-11 grid place-items-center rounded-full bg-danger/90 text-ink-900 transition hover:bg-danger hover:shadow-[0_0_24px_rgba(229,115,95,0.45)] active:scale-95"
                                    >
                                        <Icon name="end" />
                                    </button>
                                    <button
                                        onClick={skipStranger}
                                        title="Skip to someone new"
                                        className="h-11 rounded-full bg-paper pl-4 pr-3.5 text-sm font-medium text-ink-900 flex items-center gap-1.5 transition hover:bg-white hover:shadow-[0_0_28px_rgba(242,193,78,0.3)] active:scale-95"
                                    >
                                        Next <Icon name="next" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* Chat */}
                {isMatched && (
                    <aside className="flex flex-col overflow-hidden rounded-3xl border border-paper/10 bg-gradient-to-b from-ink-850 to-ink-900 min-h-[360px] lg:min-h-0">
                        <div className="flex items-end justify-between gap-3 px-5 pt-4 pb-3">
                            <h2 className="font-serif text-2xl leading-none">Chat</h2>
                            <p className={`flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] ${chatReady ? 'text-emerald-300/90' : 'text-paper-faint'}`}>
                                <Icon name="lock" small />
                                {chatReady ? 'end-to-end encrypted' : 'securing…'}
                            </p>
                        </div>
                        <div
                            className="mx-3 flex items-center justify-between gap-3 rounded-2xl border border-paper/10 bg-ink-950/50 px-3.5 py-2.5"
                            title="Read this aloud together. If both codes match, nobody is listening in between."
                        >
                            <div className="min-w-0">
                                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper-faint">Safety code</p>
                                <p className="mt-0.5 text-[11.5px] leading-snug text-paper-mute">Read it aloud. Same code, private line.</p>
                            </div>
                            <p className="shrink-0 whitespace-nowrap font-mono text-[15px] tracking-[0.16em] text-glow-soft">{safetyCode ?? '··· ···'}</p>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-1.5 max-h-[300px] lg:max-h-none" aria-live="polite">
                            {messages.length === 0 && (
                                <div className="pt-4 text-center">
                                    <p className="font-serif text-xl italic text-paper-dim">Break the ice</p>
                                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                                        {['Hey! Where are you from?', 'What are you up to today?', 'Recommend me a song'].map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => sendMessage(q)}
                                                disabled={!chatReady}
                                                className="rounded-full border border-paper/15 px-3.5 py-1.5 text-[13px] text-paper-dim transition hover:border-glow/50 hover:text-paper hover:shadow-[0_0_18px_rgba(242,193,78,0.15)] disabled:opacity-40"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {messages.map((msg, i) => {
                                if (msg.sender === 'system') {
                                    return <p key={msg.id} className="text-center font-mono text-[11px] text-paper-faint py-1">{msg.text}</p>
                                }
                                const mine = msg.sender === 'me'
                                const grouped = messages[i - 1]?.sender === msg.sender
                                return (
                                    <div key={msg.id} className={`flex animate-fade-in ${mine ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'pt-2'}`}>
                                        <div
                                            className={`max-w-[82%] break-words px-4 py-2.5 text-[14.5px] leading-snug ${
                                                mine
                                                    ? 'rounded-[20px] rounded-br-md bg-paper text-ink-900 shadow-[0_6px_24px_-8px_rgba(236,233,226,0.35)]'
                                                    : 'rounded-[20px] rounded-bl-md border border-paper/10 bg-ink-700/70 text-paper'
                                            }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>
                                )
                            })}
                            {strangerTyping && (
                                <div className="flex justify-start pt-2" aria-label="Stranger is typing">
                                    <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md border border-paper/10 bg-ink-700/70 px-4 py-3">
                                        {[0, 0.15, 0.3].map((d) => (
                                            <span key={d} className="h-1.5 w-1.5 rounded-full bg-paper-dim animate-bounce" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form
                            className="p-3"
                            onSubmit={(e) => {
                                e.preventDefault()
                                sendMessage()
                            }}
                        >
                            <div className="flex items-center gap-2 rounded-full border border-paper/10 bg-ink-950/70 p-1.5 pl-4 transition focus-within:border-paper/30 focus-within:shadow-[0_0_0_4px_rgba(236,233,226,0.04)]">
                                <input
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => onType(e.target.value)}
                                    placeholder={chatReady ? 'Say something nice' : 'Securing chat…'}
                                    disabled={!chatReady}
                                    maxLength={2000}
                                    autoComplete="off"
                                    aria-label="Message"
                                    className="flex-1 min-w-0 bg-transparent py-1.5 text-[14.5px] placeholder:text-paper-faint outline-none disabled:opacity-60"
                                />
                                <button type="submit" disabled={!chatReady || !messageInput.trim()} className="btn-primary h-9 w-9 shrink-0 justify-center p-0" aria-label="Send">
                                    <Icon name="send" />
                                </button>
                            </div>
                        </form>
                    </aside>
                )}
            </div>

            {/* Searching */}
            {isSearching && (
                <section className="relative z-10 mx-auto max-w-page px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center text-center rise" aria-live="polite">
                    <Orbit />
                    <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-mute">Matching</p>
                    <h2 className="mt-3 font-serif text-4xl sm:text-5xl">
                        Finding <em className="text-glow-soft">someone new…</em>
                    </h2>
                    <p className="mt-4 max-w-sm text-paper-mute">This usually takes a few seconds. Keep this tab open.</p>
                    {lastPeer && (
                        <div className="mt-8">
                            <RematchQuestion answer={rematchAnswer} onAnswer={answerRematch} />
                        </div>
                    )}
                    <button onClick={cancelSearch} className="btn-ghost mt-8 px-5 py-2.5 text-sm text-paper-mute">
                        Cancel
                    </button>
                </section>
            )}

            {/* After a call */}
            {idle && callEnded && (
                <section className="relative z-10 mx-auto max-w-page px-4 sm:px-6 py-16 sm:py-24 text-center rise">
                    <CupsLine />
                    <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-mute">Conversation ended</p>
                    <h2 className="mt-4 font-serif text-4xl sm:text-6xl leading-[1.02]">
                        Ready for <em className="text-glow-soft">the next one?</em>
                    </h2>
                    <p className="mt-4 text-paper-mute">{callEnded}</p>
                    {lastPeer && (
                        <div className="mt-8">
                            <RematchQuestion answer={rematchAnswer} onAnswer={answerRematch} />
                        </div>
                    )}
                    <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button onClick={requestStart} disabled={!isConnected} className="btn-primary px-7 py-3.5 text-[15px]">
                            Meet someone new
                        </button>
                        <button onClick={() => setCallEnded(null)} className="btn-ghost px-6 py-3.5 text-[15px]">
                            Back to home
                        </button>
                    </div>
                </section>
            )}

            {/* Marketing landing */}
            {idle && !callEnded && <Landing onStart={requestStart} isConnected={isConnected} />}

            {/* Toast */}
            {notice && (
                <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-paper/15 bg-ink-800/95 backdrop-blur px-5 py-3 text-sm text-paper shadow-2xl animate-fade-in">
                    {notice}
                </div>
            )}

            {/* 18+ and rules */}
            {showAgeGate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="age-title">
                    <div className="max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl border border-paper/10 bg-ink-850 p-7 shadow-2xl animate-fade-in">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-glow-soft">Adults only</p>
                        <h3 id="age-title" className="mt-3 font-serif text-3xl leading-tight">Before you meet <em>someone new</em></h3>
                        <ul className="mt-5 space-y-3 text-[14.5px] leading-relaxed text-paper-mute">
                            {[
                                ['You are 18 or older.', 'Strangers Connect is only for adults.'],
                                ['You meet real, unknown people.', 'We cannot see or control what others say or show, and we are not responsible for their behavior.'],
                                ['Keep yourself safe.', 'Do not share your full name, address, passwords or anything you would not tell a stranger on the street.'],
                                ['Be decent.', 'No nudity, harassment, hate or anything illegal. Press Report and you are disconnected instantly.'],
                                ['Nothing is recorded by us,', 'but the other person could record their own screen. Act accordingly.'],
                            ].map(([t, d]) => (
                                <li key={t} className="flex gap-3">
                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-glow" />
                                    <span><span className="text-paper">{t}</span> {d}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3">
                            <button onClick={() => setShowAgeGate(false)} className="btn-ghost flex-1 justify-center py-3 text-sm">
                                I am under 18
                            </button>
                            <button onClick={acceptRules} disabled={!isConnected} className="btn-primary flex-1 justify-center py-3 text-sm">
                                I am 18+ and agree
                            </button>
                        </div>
                        <p className="mt-4 text-center text-xs text-paper-faint">You use Strangers Connect at your own risk.</p>
                    </div>
                </div>
            )}

            {/* Report modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-title">
                    <div className="max-w-md w-full rounded-3xl border border-paper/10 bg-ink-850 p-7 shadow-2xl animate-fade-in">
                        <div className="text-danger"><Icon name="flag" /></div>
                        <h3 id="report-title" className="mt-4 font-serif text-3xl">Report this person?</h3>
                        <p className="mt-3 text-[15px] leading-relaxed text-paper-mute">
                            You will be disconnected right away. People who get reported by several different users are banned automatically.
                        </p>
                        <div className="mt-7 flex gap-3">
                            <button onClick={cancelReport} className="btn-ghost flex-1 justify-center py-3 text-sm">Cancel</button>
                            <button onClick={confirmReport} className="flex-1 rounded-full bg-danger py-3 text-sm font-medium text-ink-900 hover:brightness-110 transition">Report and leave</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="relative z-10 border-t border-paper/10">
                <div className="mx-auto max-w-page px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-paper-faint">
                    <p>
                        <span className="font-serif text-lg text-paper-dim">Strangers Connect</span>
                        <span className="ml-3">Free, private, for adults 18+.</span>
                    </p>
                    <button onClick={() => setShowAgeGate(true)} className="hover:text-paper transition-colors">
                        Rules and safety
                    </button>
                </div>
            </footer>
        </div>
    )
}

function DockButton({ label, active, pressed, onClick, children }: { label: string; active?: boolean; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={pressed ?? active}
            className={`h-11 w-11 grid place-items-center rounded-full transition active:scale-95 ${
                active ? 'bg-paper text-ink-900' : pressed ? 'bg-paper/15 text-paper' : 'text-paper hover:bg-paper/10'
            }`}
        >
            {children}
        </button>
    )
}

// Two people circling until they find each other
function Orbit() {
    return (
        <svg viewBox="0 0 200 200" className="h-44 w-44 sm:h-52 sm:w-52" aria-hidden="true">
            <defs>
                <filter id="orbit-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" />
                </filter>
            </defs>
            <circle cx="100" cy="100" r="70" fill="none" stroke="#ece9e2" strokeOpacity="0.08" />
            <circle cx="100" cy="100" r="46" fill="none" stroke="#ece9e2" strokeOpacity="0.12" strokeDasharray="2 6" className="spin-slow" />
            <g className="orbit-a">
                <circle cx="100" cy="30" r="5" fill="#ece9e2" />
            </g>
            <g className="orbit-b">
                <circle cx="100" cy="170" r="5" fill="#ece9e2" />
            </g>
            <circle cx="100" cy="100" r="9" fill="#f2c14e" opacity="0.5" filter="url(#orbit-glow)" className="breathe" />
            <circle cx="100" cy="100" r="3.5" fill="#f6d488" />
        </svg>
    )
}

// The logo's paper-cup telephone, drawn in and gently swaying
function CupsLine() {
    return (
        <svg viewBox="0 0 32 32" className="mx-auto h-24 w-24 sway" aria-hidden="true">
            <defs>
                <filter id="cups-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="1.4" />
                </filter>
            </defs>
            <g fill="none" stroke="#ece9e2" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
                <path className="draw" style={{ ['--len' as string]: 60 }} d="M14.2 8 H10.8 C 7.4 8, 6.6 12, 9 13.6 L 23 18.4 C 25.4 20, 24.6 24, 21.2 24 H17.8" />
                <path d="M14.2 6 L23.2 4.3 M14.2 10 L23.2 11.7" />
                <ellipse cx="23.2" cy="8" rx="1.3" ry="3.7" fill="#0e0e10" />
                <ellipse cx="14.2" cy="8" rx="0.6" ry="2" />
                <path d="M17.8 22 L8.8 20.3 M17.8 26 L8.8 27.7" />
                <ellipse cx="8.8" cy="24" rx="1.3" ry="3.7" fill="#0e0e10" />
                <ellipse cx="17.8" cy="24" rx="0.6" ry="2" />
            </g>
            <circle cx="16" cy="16" r="2" fill="#f2c14e" filter="url(#cups-glow)" className="breathe" />
            <circle cx="16" cy="16" r="0.9" fill="#f6d488" />
        </svg>
    )
}

function RematchQuestion({ answer, onAnswer }: { answer: 'yes' | 'no' | null; onAnswer: (a: 'yes' | 'no') => void }) {
    if (answer) {
        return (
            <p className="font-mono text-[11px] text-paper-faint animate-fade-in">
                {answer === 'no' ? 'Got it. You will not be matched with them again.' : 'Noted. You might meet again someday.'}
            </p>
        )
    }
    return (
        <div className="inline-flex flex-col sm:flex-row items-center gap-3 rounded-3xl sm:rounded-full border border-paper/10 bg-ink-850/80 px-5 py-4 sm:py-2 sm:pl-5 sm:pr-2 animate-fade-in">
            <span className="text-sm text-paper-dim">Okay to meet this person again someday?</span>
            <span className="flex gap-1.5">
                <button onClick={() => onAnswer('yes')} className="rounded-full border border-paper/15 px-4 py-1.5 text-sm hover:border-paper/40 hover:bg-paper/5">Sure</button>
                <button onClick={() => onAnswer('no')} className="rounded-full border border-paper/15 px-4 py-1.5 text-sm hover:border-paper/40 hover:bg-paper/5">No, never</button>
            </span>
        </div>
    )
}

function Icon({ name, small }: { name: 'mic' | 'micOff' | 'cam' | 'camOff' | 'speaker' | 'next' | 'end' | 'flag' | 'lock' | 'send'; small?: boolean }) {
    const p: Record<typeof name, React.ReactElement> = {
        mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
        micOff: <><path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18" /></>,
        cam: <><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5 21 7v10l-5-3.5" /></>,
        camOff: <><path d="M16 16v.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5v-8A2.5 2.5 0 0 1 5 6M9.5 6h4A2.5 2.5 0 0 1 16 8.5v3l5-3.5v10M3 3l18 18" /></>,
        speaker: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>,
        next: <><path d="M6 6l8 6-8 6V6ZM18 6v12" /></>,
        end: <><path d="M3 15.5c5-4.7 13-4.7 18 0l-2.2 2.3-3.3-1.6v-2.6a12 12 0 0 0-7 0v2.6l-3.3 1.6L3 15.5Z" /></>,
        flag: <><path d="M5 21V4M5 4.5c4-2.5 7 2.5 13 0v9c-6 2.5-9-2.5-13 0" /></>,
        lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
        send: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
    }
    return (
        <svg viewBox="0 0 24 24" className={small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {p[name]}
        </svg>
    )
}
