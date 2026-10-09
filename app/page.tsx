'use client'

import { useState, useEffect, useRef } from 'react'
import type React from 'react'
import { Signal, deviceId } from '@/lib/signal'
import { checkMessage, splitLinks, type SafetyReport } from '@/lib/chatSafety'
import { v4 as uuidv4 } from 'uuid'
import Landing from '@/components/Landing'
import { SearchRings } from '@/components/Illustrations'
import { LogoMark } from '@/components/Logo'
import { drawFaceFx, loadFaceLandmarker, type FaceFx } from '@/lib/faceFx'
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { FaceRenderer, WarpName } from '@/lib/faceRender'
import type { PaintName } from '@/lib/faceTextures'
import { loadSegmenter, paintScene, sceneThumb, type BackgroundName } from '@/lib/backgrounds'
import type { ImageSegmenter } from '@mediapipe/tasks-vision'

type PropName = 'bunny' | 'kitty' | 'shades'
type VideoFilter = 'none' | PaintName | WarpName | PropName | 'blur' | 'pixel'

type FilterDef = { label: string; thumb: string; css: string; face?: boolean; paint?: PaintName; warp?: WarpName; prop?: PropName; group: 'off' | 'face' | 'privacy' }

const FILTERS: Record<VideoFilter, FilterDef> = {
    none: { label: 'Off', thumb: '', css: 'none', group: 'off' },
    bunny: { label: 'Bunny', thumb: '🐰', css: 'none', face: true, prop: 'bunny', group: 'face' },
    bigeyes: { label: 'Big eyes', thumb: '👀', css: 'none', face: true, warp: 'bigeyes', group: 'face' },
    neon: { label: 'Neon', thumb: '💠', css: 'none', face: true, paint: 'neon', group: 'face' },
    alien: { label: 'Alien', thumb: '👽', css: 'none', face: true, warp: 'alien', group: 'face' },
    kitty: { label: 'Kitty', thumb: '🐱', css: 'none', face: true, prop: 'kitty', group: 'face' },
    tiger: { label: 'Tiger', thumb: '🐯', css: 'none', face: true, paint: 'tiger', group: 'face' },
    shades: { label: 'Shades', thumb: '😎', css: 'none', face: true, prop: 'shades', group: 'face' },
    glam: { label: 'Glam', thumb: '💄', css: 'none', face: true, paint: 'glam', group: 'face' },
    skull: { label: 'Skull', thumb: '💀', css: 'none', face: true, paint: 'skull', group: 'face' },
    bignose: { label: 'Big nose', thumb: '👃', css: 'none', face: true, warp: 'bignose', group: 'face' },
    blur: { label: 'Blur me', thumb: '🌫️', css: 'blur(16px)', group: 'privacy' },
    pixel: { label: 'Pixelate', thumb: '🧊', css: 'none', group: 'privacy' },
}

const BACKGROUNDS: { id: BackgroundName; label: string }[] = [
    { id: 'none', label: 'Off' },
    { id: 'blur', label: 'Blur room' },
    { id: 'aurora', label: 'Aurora' },
    { id: 'sunset', label: 'Sunset' },
    { id: 'night', label: 'Night' },
    { id: 'studio', label: 'Studio' },
    { id: 'paper', label: 'Grid' },
    { id: 'custom', label: 'Your photo' },
]

// Older Safari has no canvas filters; there, Blur falls back to a heavy mosaic
const CANVAS_FILTERS = (() => {
    if (typeof document === 'undefined') return true
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx || !('filter' in ctx)) return false
    ctx.filter = 'blur(2px)'
    return ctx.filter === 'blur(2px)'
})()

const REACTIONS = ['❤️', '😂', '😮', '👏', '🔥', '👋']
const CHAT_EMOJIS = ['😀', '😂', '🥹', '😊', '😍', '😎', '🤔', '😅', '🙌', '👍', '👋', '🙏', '🔥', '✨', '🎉', '❤️']

interface Message {
    id: string
    text: string
    sender: 'me' | 'stranger' | 'system'
    safety?: SafetyReport
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
    const [showSafety, setShowSafety] = useState(false)
    // Countdown to the next search after the other person leaves (null = off)
    const [autoNext, setAutoNext] = useState<number | null>(null)
    // How busy it is while you wait, and whether the wait is getting long
    const [queueInfo, setQueueInfo] = useState<{ online: number; searching: number } | null>(null)
    const [slowSearch, setSlowSearch] = useState(false)
    // A message held back because it looks like personal info, waiting for "send anyway"
    const [pendingSend, setPendingSend] = useState<{ text: string; kinds: string[] } | null>(null)
    const [revealed, setRevealed] = useState<Set<string>>(new Set())
    const [awayPaused, setAwayPaused] = useState(false)
    // Relay servers handed out by the signaling server on each match
    const iceServersRef = useRef<RTCIceServer[]>([])
    // Shown when video cannot get through between the two networks
    const [connIssue, setConnIssue] = useState(false)
    // Safe start: a new stranger's video stays blurred until you choose to see it
    const [safeStart, setSafeStart] = useState(false)
    const safeStartRef = useRef(false)
    // Privacy for yourself: each chat starts with your camera blurred until you tap Show me
    const [selfHidden, setSelfHidden] = useState(false)
    const selfHiddenRef = useRef(false)
    const [startHidden, setStartHidden] = useState(true)
    const startHiddenRef = useRef(true)
    const [remoteHidden, setRemoteHidden] = useState(true)
    const [cameraState, setCameraState] = useState<'idle' | 'asking' | 'ready' | 'denied'>('idle')

    // Privacy filters run on this device before video is sent, so the raw face never leaves it
    const [videoFilter, setVideoFilter] = useState<VideoFilter>('none')
    const filterRef = useRef<VideoFilter>('none')
    const filterPipeRef = useRef<{ timer: ReturnType<typeof setInterval>; track: MediaStreamTrack; video: HTMLVideoElement; renderer: FaceRenderer | null; rendererSrc?: HTMLCanvasElement } | null>(null)
    const [localPreview, setLocalPreview] = useState<MediaStream | null>(null)
    const faceLmRef = useRef<FaceLandmarker | null>(null)
    const faceRenderModRef = useRef<typeof import('@/lib/faceRender') | null>(null)
    const [faceLoading, setFaceLoading] = useState(false)
    const [background, setBackground] = useState<BackgroundName>('none')
    const bgRef = useRef<BackgroundName>('none')
    const segmenterRef = useRef<ImageSegmenter | null>(null)
    const customBgRef = useRef<HTMLImageElement | null>(null)
    const [filterTab, setFilterTab] = useState<'face' | 'background' | 'privacy'>('face')
    const bgInputRef = useRef<HTMLInputElement | null>(null)
    const [openPanel, setOpenPanel] = useState<'none' | 'volume' | 'filters' | 'react'>('none')
    const [floaters, setFloaters] = useState<{ id: string; e: string; x: number; mine: boolean }[]>([])
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
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
                // Relay (TURN) from our signaling server, for networks that block direct calls
                ...iceServersRef.current,
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
            if (state === 'connected' || state === 'completed') setConnIssue(false)
            if (state === 'failed') setConnIssue(true)
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
            // Camera is normally opened before searching; open it now only if it is not live
            const existing = localStreamRef.current
            const stream = existing && existing.getTracks().every((t) => t.readyState === 'live') ? existing : await openCamera()
            if (!stream) return
            console.log('✅ Got camera access')
            console.log('📹 Video tracks:', stream.getVideoTracks().length)
            console.log('🎤 Audio tracks:', stream.getAudioTracks().length)

            localStreamRef.current = stream
            const rawVideo = stream.getVideoTracks()[0]
            let outVideo = rawVideo
            if (rawVideo && (filterRef.current !== 'none' || bgRef.current !== 'none' || selfHiddenRef.current)) {
                if (FILTERS[filterRef.current].face) await ensureFaceTracker()
                if (bgRef.current !== 'none') await ensureSegmenter()
                const built = buildFilteredTrack(rawVideo)
                await settle(built.ready)
                outVideo = built.track
            }
            setLocalPreview(outVideo ? new MediaStream([outVideo]) : null)

            // Ensure local video is visible
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = outVideo ? new MediaStream([outVideo]) : stream
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
            // With a filter on, the canvas track is sent instead of the raw camera
            const outgoing = [...stream.getAudioTracks(), ...(outVideo ? [outVideo] : [])]
            outgoing.forEach((track) => {
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

    // Draws the camera into a canvas with the chosen filter. Returns the canvas track and a
    // promise that resolves once a real frame has been drawn, so callers can switch over
    // without the video ever going blank.
    const buildFilteredTrack = (raw: MediaStreamTrack): { track: MediaStreamTrack; ready: Promise<void> } => {
        stopFilterPipe()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        const small = document.createElement('canvas')
        const sctx = small.getContext('2d')!
        const frame = document.createElement('canvas')
        const fctx = frame.getContext('2d')!
        const scratch = document.createElement('canvas')
        let w = 0
        let h = 0
        let lastFace: { lm: NormalizedLandmark[]; at: number } | null = null

        // iOS only decodes frames for video elements that are in the document
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.setAttribute('playsinline', '')
        video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1'
        document.body.appendChild(video)
        video.srcObject = new MediaStream([raw])
        video.play().catch(() => {})

        let markReady: () => void = () => {}
        const ready = new Promise<void>((resolve) => (markReady = resolve))

        // Match the canvas to the camera's real frames (portrait phones, rotation)
        const fitToVideo = () => {
            const vw = video.videoWidth
            const vh = video.videoHeight
            if (!vw || !vh) return false
            const scale = Math.min(1, 720 / Math.max(vw, vh))
            const nw = Math.round(vw * scale)
            const nh = Math.round(vh * scale)
            if (nw !== w || nh !== h) {
                w = canvas.width = frame.width = nw
                h = canvas.height = frame.height = nh
                const pipe = filterPipeRef.current
                if (pipe?.renderer) {
                    pipe.renderer.dispose()
                    pipe.renderer = null
                }
            }
            return true
        }

        // Background compositing buffers
        const comp = document.createElement('canvas')
        const cctx = comp.getContext('2d')!
        const person = document.createElement('canvas')
        const pctx = person.getContext('2d')!
        const maskCanvas = document.createElement('canvas')
        const mctx = maskCanvas.getContext('2d')!
        let maskData: ImageData | null = null
        let sceneCache: { key: string; canvas: HTMLCanvasElement } | null = null

        const backgroundFor = (bg: BackgroundName): CanvasImageSource | null => {
            if (bg === 'custom') return customBgRef.current
            if (bg === 'none' || bg === 'blur') return null
            const key = `${bg}:${w}x${h}`
            if (sceneCache?.key !== key) sceneCache = { key, canvas: paintScene(bg, w, h) }
            return sceneCache.canvas
        }

        // Draws img to cover the whole canvas, like CSS object-fit: cover
        const drawCover = (target: CanvasRenderingContext2D, img: CanvasImageSource) => {
            const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width
            const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height
            const scale = Math.max(w / iw, h / ih)
            const dw = iw * scale
            const dh = ih * scale
            target.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
        }

        // Replace or blur the room behind the person; result lands in comp
        const composeBackground = (bg: BackgroundName) => {
            const seg = segmenterRef.current
            if (comp.width !== w || comp.height !== h) {
                comp.width = person.width = w
                comp.height = person.height = h
            }
            if (!seg) {
                cctx.drawImage(frame, 0, 0)
                return
            }
            try {
                seg.segmentForVideo(frame, performance.now(), (result) => {
                    const mask = result.confidenceMasks?.[0]
                    if (!mask) return
                    const mw = mask.width
                    const mh = mask.height
                    if (maskCanvas.width !== mw || maskCanvas.height !== mh || !maskData) {
                        maskCanvas.width = mw
                        maskCanvas.height = mh
                        maskData = mctx.createImageData(mw, mh)
                    }
                    const conf = mask.getAsFloat32Array()
                    const px = maskData.data
                    for (let k = 0; k < conf.length; k++) {
                        // Soft edge: ramp alpha between 0.35 and 0.75 confidence
                        const a = Math.min(1, Math.max(0, (conf[k] - 0.35) / 0.4))
                        px[k * 4 + 3] = a * 255
                    }
                    mctx.putImageData(maskData, 0, 0)
                })
            } catch {
                // keep the previous mask for a dropped frame
            }
            // Background layer
            const img = backgroundFor(bg)
            if (bg === 'blur' || !img) {
                cctx.filter = CANVAS_FILTERS ? 'blur(14px)' : 'none'
                cctx.drawImage(frame, -20, -20, w + 40, h + 40)
                cctx.filter = 'none'
            } else {
                drawCover(cctx, img)
            }
            // Person layer, cut out with the mask (scaled up smoothly for soft edges)
            pctx.globalCompositeOperation = 'source-over'
            pctx.clearRect(0, 0, w, h)
            pctx.drawImage(frame, 0, 0)
            pctx.globalCompositeOperation = 'destination-in'
            pctx.imageSmoothingEnabled = true
            pctx.drawImage(maskCanvas, 0, 0, w, h)
            pctx.globalCompositeOperation = 'source-over'
            cctx.drawImage(person, 0, 0)
        }

        const drawEffect = () => {
            if (video.readyState < 2 || !fitToVideo()) return
            const f = filterRef.current
            const bg = bgRef.current
            const def = FILTERS[f]

            // 1. Clean camera frame (also what face tracking looks at)
            fctx.drawImage(video, 0, 0, w, h)
            // 2. Background replacement on top of it
            let src: HTMLCanvasElement = frame
            if (bg !== 'none') {
                composeBackground(bg)
                src = comp
            }

            // 3. Effect
            if (f === 'pixel' || (f === 'blur' && !CANVAS_FILTERS)) {
                // Mosaic: shrink then stretch without smoothing. Works in every browser.
                const block = f === 'pixel' ? 14 : 22
                small.width = Math.max(1, Math.round(w / block))
                small.height = Math.max(1, Math.round(h / block))
                sctx.drawImage(src, 0, 0, small.width, small.height)
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(small, 0, 0, w, h)
                ctx.imageSmoothingEnabled = true
                markReady()
                return
            }
            if (def.face) {
                const lmk = faceLmRef.current
                if (lmk) {
                    try {
                        const res = lmk.detectForVideo(frame, performance.now())
                        if (res.faceLandmarks[0]) lastFace = { lm: res.faceLandmarks[0], at: performance.now() }
                    } catch {
                        // a dropped frame is fine
                    }
                }
                // Keep the effect on through brief tracking blips
                const lm = lastFace && performance.now() - lastFace.at < 400 ? lastFace.lm : null
                const pipe = filterPipeRef.current
                // The GPU renderer reads from a fixed canvas; rebuild it if the source changed
                if (pipe?.renderer && pipe.rendererSrc !== src) {
                    pipe.renderer.dispose()
                    pipe.renderer = null
                }
                if ((def.paint || def.warp) && pipe && !pipe.renderer && faceRenderModRef.current) {
                    try {
                        pipe.renderer = new faceRenderModRef.current.FaceRenderer(src)
                        pipe.rendererSrc = src
                    } catch (error) {
                        console.error('WebGL unavailable for face effects:', error)
                    }
                }
                if ((def.paint || def.warp) && pipe?.renderer) {
                    ctx.drawImage(pipe.renderer.render(lm, { warp: def.warp, paint: def.paint }), 0, 0)
                } else {
                    ctx.drawImage(src, 0, 0)
                }
                if (def.prop && lm) drawFaceFx(ctx, src, lm, def.prop as FaceFx, scratch)
                markReady()
                return
            }
            ctx.filter = CANVAS_FILTERS ? def.css : 'none'
            ctx.drawImage(src, 0, 0, w, h)
            ctx.filter = 'none'
            markReady()
        }
        // Self-blur sits on top of everything else and is applied before sending
        const hideBuf = document.createElement('canvas')
        const hctx = hideBuf.getContext('2d')!
        const draw = () => {
            drawEffect()
            if (!selfHiddenRef.current || !w) return
            if (CANVAS_FILTERS) {
                if (hideBuf.width !== w || hideBuf.height !== h) {
                    hideBuf.width = w
                    hideBuf.height = h
                }
                hctx.drawImage(canvas, 0, 0)
                ctx.filter = 'blur(28px)'
                ctx.drawImage(hideBuf, -30, -30, w + 60, h + 60)
                ctx.filter = 'none'
            } else {
                small.width = Math.max(1, Math.round(w / 28))
                small.height = Math.max(1, Math.round(h / 28))
                sctx.drawImage(canvas, 0, 0, small.width, small.height)
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(small, 0, 0, w, h)
                ctx.imageSmoothingEnabled = true
            }
        }
        const timer = setInterval(draw, 1000 / 24)
        const track = canvas.captureStream(24).getVideoTracks()[0]
        filterPipeRef.current = { timer, track, video, renderer: null }
        return { track, ready }
    }

    // Never wait forever: after this long, switch anyway
    const settle = (ready: Promise<void>, ms = 2500) => Promise.race([ready, new Promise<void>((r) => setTimeout(r, ms))])

    const stopFilterPipe = () => {
        const pipe = filterPipeRef.current
        if (!pipe) return
        clearInterval(pipe.timer)
        pipe.renderer?.dispose()
        pipe.track.stop()
        pipe.video.srcObject = null
        pipe.video.remove()
        filterPipeRef.current = null
    }

    const ensureFaceTracker = async () => {
        if (faceLmRef.current && faceRenderModRef.current) return true
        setFaceLoading(true)
        try {
            const [lmk, mod] = await Promise.all([loadFaceLandmarker(), import('@/lib/faceRender')])
            faceLmRef.current = lmk
            faceRenderModRef.current = mod
            return true
        } catch (error) {
            console.error('Face filters unavailable:', error)
            setNotice('Face filters are not supported on this device.')
            return false
        } finally {
            setFaceLoading(false)
        }
    }

    // Applies the current effect + background to the outgoing video and the preview.
    // The canvas pipeline only runs while something is switched on.
    const applyVideoPipeline = async () => {
        const raw = localStreamRef.current?.getVideoTracks()[0]
        if (!raw) return
        const sender = peerConnectionRef.current?.getSenders().find((x) => x.track?.kind === 'video')
        const needed = filterRef.current !== 'none' || bgRef.current !== 'none' || selfHiddenRef.current
        const pipe = filterPipeRef.current
        if (!needed) {
            if (!pipe) return
            await sender?.replaceTrack(raw)
            setLocalPreview(new MediaStream([raw]))
            // Let the preview switch first, then tear the canvas down
            setTimeout(() => {
                if (filterRef.current === 'none' && bgRef.current === 'none' && !selfHiddenRef.current) stopFilterPipe()
            }, 300)
            return
        }
        // Already running: the draw loop reads the refs, so the switch is instant
        if (pipe) {
            if (sender && sender.track !== pipe.track) {
                await sender.replaceTrack(pipe.track)
                setLocalPreview(new MediaStream([pipe.track]))
            }
            return
        }
        // Build in the background and keep sending the camera until the first frame is ready
        const { track, ready } = buildFilteredTrack(raw)
        await settle(ready)
        if (filterRef.current === 'none' && bgRef.current === 'none' && !selfHiddenRef.current) return
        await sender?.replaceTrack(track)
        setLocalPreview(new MediaStream([track]))
    }

    const chooseFilter = async (f: VideoFilter) => {
        if (FILTERS[f].face && !(await ensureFaceTracker())) f = 'none'
        setVideoFilter(f)
        filterRef.current = f
        try {
            localStorage.setItem('sc-filter', f)
        } catch {
            // ignore
        }
        await applyVideoPipeline()
    }

    const ensureSegmenter = async () => {
        if (segmenterRef.current) return true
        setFaceLoading(true)
        try {
            segmenterRef.current = await loadSegmenter()
            return true
        } catch (error) {
            console.error('Backgrounds unavailable:', error)
            setNotice('Backgrounds are not supported on this device.')
            return false
        } finally {
            setFaceLoading(false)
        }
    }

    const chooseBackground = async (b: BackgroundName) => {
        if (b === 'custom' && !customBgRef.current) {
            bgInputRef.current?.click()
            return
        }
        if (b !== 'none' && !(await ensureSegmenter())) b = 'none'
        setBackground(b)
        bgRef.current = b
        try {
            if (b !== 'custom') localStorage.setItem('sc-bg', b)
        } catch {
            // ignore
        }
        await applyVideoPipeline()
    }

    // A photo chosen from the device stays on the device
    const onBackgroundFile = (file: File | undefined) => {
        if (!file || !file.type.startsWith('image/')) return
        const img = new Image()
        img.onload = () => {
            customBgRef.current = img
            chooseBackground('custom')
        }
        img.src = URL.createObjectURL(file)
    }

    // Remember the filter between visits
    useEffect(() => {
        try {
            const saved = localStorage.getItem('sc-filter') as VideoFilter | null
            if (saved && saved in FILTERS) {
                setVideoFilter(saved)
                filterRef.current = saved
            }
            const savedBg = localStorage.getItem('sc-bg') as BackgroundName | null
            if (savedBg && BACKGROUNDS.some((b) => b.id === savedBg) && savedBg !== 'custom') {
                setBackground(savedBg)
                bgRef.current = savedBg
            }
        } catch {
            // ignore
        }
    }, [])

    // The self-view only exists once a match renders, so attach the stream whenever it appears
    useEffect(() => {
        const el = localVideoRef.current
        if (!el || !isMatched || !localPreview) return
        if (el.srcObject !== localPreview) {
            el.srcObject = localPreview
            el.play().catch(() => {})
        }
    }, [isMatched, localPreview, isLocalMain])

    const spawnFloater = (e: string, mine: boolean) => {
        const id = uuidv4()
        setFloaters((prev) => [...prev.slice(-12), { id, e, x: 10 + Math.random() * 80, mine }])
        setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== id)), 2600)
    }

    // Everything sent to the stranger is a small JSON payload, encrypted end to end
    const sendPayload = async (payload: { k: 'msg'; t: string } | { k: 'react'; e: string }) => {
        if (!socket || !strangerId || !encryptionKeyRef.current) return false
        const ciphertext = await encryptMessage(JSON.stringify(payload), encryptionKeyRef.current)
        socket.emit('send-message', { text: ciphertext, to: strangerId, encrypted: true })
        return true
    }

    const sendReaction = async (e: string) => {
        if (await sendPayload({ k: 'react', e })) spawnFloater(e, true)
    }

    // Stop video
    const stopVideo = () => {
        stopFilterPipe()
        setLocalPreview(null)
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

        newSocket.on('matched', async (data: { strangerId: string; iceServers?: RTCIceServer[] }) => {
            iceServersRef.current = Array.isArray(data.iceServers) ? data.iceServers : []
            setConnIssue(false)
            setRemoteHidden(safeStartRef.current)
            selfHiddenRef.current = startHiddenRef.current
            setSelfHidden(startHiddenRef.current)
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
            setAutoNext(5)
        })

        newSocket.on('queue', (data: { online: number; searching: number }) => {
            if (typeof data?.online === 'number') setQueueInfo(data)
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
                const raw = await decryptMessage(data.text, encryptionKeyRef.current)
                let payload: { k?: string; t?: string; e?: string } = {}
                try {
                    payload = JSON.parse(raw)
                } catch {
                    payload = { k: 'msg', t: raw }
                }
                if (payload.k === 'react') {
                    if (payload.e && REACTIONS.includes(payload.e)) spawnFloater(payload.e, false)
                } else if (typeof payload.t === 'string' && payload.t.trim()) {
                    const text = payload.t.slice(0, 2000)
                    setMessages((prev) => [...prev, { id: uuidv4(), text, sender: 'stranger', safety: checkMessage(text) }])
                }
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

    const openCamera = async (): Promise<MediaStream | null> => {
        setCameraState('asking')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: { echoCancellation: true, noiseSuppression: true },
            })
            setCameraState('ready')
            return stream
        } catch (error) {
            console.error('Camera unavailable:', error)
            setCameraState('denied')
            return null
        }
    }

    // Open the camera first, so the person you meet never waits on a permission prompt
    const findStranger = async () => {
        if (!socket) return
        setAutoNext(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setCallEnded(null)
        setIsSearching(true)
        const live = localStreamRef.current?.getTracks().every((t) => t.readyState === 'live')
        if (!live) {
            const stream = await openCamera()
            if (!stream) {
                setIsSearching(false)
                setNotice('Camera access is needed to video chat. Allow it in your browser settings and try again.')
                return
            }
            localStreamRef.current = stream
            setLocalPreview(new MediaStream(stream.getVideoTracks()))
        }
        socket.emit('find-stranger')
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

    // Skip to the next stranger
    const skipStranger = () => {
        if (socket && strangerId) {
            // Disconnect from current stranger; "skip" keeps them away from you for a little while
            socket.emit('disconnect-stranger', { strangerId, skip: true })
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
                findStranger()
            }, 100) // Small delay to ensure cleanup completes
        }
    }

    useEffect(() => {
        if (!isMatched || remoteVideoReady) return
        const t = setTimeout(() => setConnIssue(true), 20000)
        return () => clearTimeout(t)
    }, [isMatched, remoteVideoReady])

    useEffect(() => {
        if (remoteVideoReady) setConnIssue(false)
    }, [remoteVideoReady])

    // Remember the safe start choice
    useEffect(() => {
        try {
            const hiddenPref = localStorage.getItem('sc-start-hidden') !== 'off'
            setStartHidden(hiddenPref)
            startHiddenRef.current = hiddenPref
            // Blurring strangers is now opt-in
            const v = localStorage.getItem('sc-safe-start') === 'on'
            setSafeStart(v)
            safeStartRef.current = v
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        if (!isMatched) {
            setShowSafety(false)
            setConnIssue(false)
            setOpenPanel('none')
            setShowEmojiPicker(false)
            setFloaters([])
        }
    }, [isMatched])

    // Your camera pauses while you are in another tab or app, so nobody sees you unawares
    useEffect(() => {
        if (!isMatched) return
        const onVisibility = () => {
            const tracks = [...(localStreamRef.current?.getVideoTracks() ?? []), ...(filterPipeRef.current ? [filterPipeRef.current.track] : [])]
            if (document.hidden) {
                tracks.forEach((t) => (t.enabled = false))
                setAwayPaused(true)
            } else {
                tracks.forEach((t) => (t.enabled = isLocalCameraEnabled))
                setAwayPaused((was) => {
                    if (was) setNotice('Your camera was paused while you were away.')
                    return false
                })
            }
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => document.removeEventListener('visibilitychange', onVisibility)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMatched, isLocalCameraEnabled])

    // Quick exit: Esc leaves the conversation right away
    useEffect(() => {
        if (!isMatched) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || showReportModal || showAgeGate) return
            const tag = (e.target as HTMLElement | null)?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            disconnect()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMatched, showReportModal, showAgeGate, strangerId])

    // Tick the auto-search countdown and start searching when it reaches zero
    useEffect(() => {
        if (autoNext === null || isMatched || isSearching || !callEnded) return
        if (autoNext <= 0) {
            findStranger()
            return
        }
        const t = setTimeout(() => setAutoNext((n) => (n === null ? null : n - 1)), 1000)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoNext, isMatched, isSearching, callEnded])

    // After a few seconds of searching, explain the wait instead of looking stuck
    useEffect(() => {
        setSlowSearch(false)
        if (!isSearching) return
        const t = setTimeout(() => setSlowSearch(true), 7000)
        return () => clearTimeout(t)
    }, [isSearching])

    const showMe = async () => {
        selfHiddenRef.current = false
        setSelfHidden(false)
        await applyVideoPipeline()
    }

    const hideMe = async () => {
        selfHiddenRef.current = true
        setSelfHidden(true)
        await applyVideoPipeline()
    }

    const toggleStartHidden = (on: boolean) => {
        setStartHidden(on)
        startHiddenRef.current = on
        try {
            localStorage.setItem('sc-start-hidden', on ? 'on' : 'off')
        } catch {
            // ignore
        }
    }

    const toggleSafeStart = (on: boolean) => {
        setSafeStart(on)
        safeStartRef.current = on
        if (!on) setRemoteHidden(false)
        try {
            localStorage.setItem('sc-safe-start', on ? 'on' : 'off')
        } catch {
            // ignore
        }
    }

    const answerRematch = (answer: 'yes' | 'no') => {
        setRematchAnswer(answer)
        if (answer === 'no' && socket && lastPeer) socket.emit('avoid', { peerId: lastPeer })
    }

    const cancelSearch = () => {
        socket?.emit('cancel-search')
        setIsSearching(false)
        localStreamRef.current?.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setLocalPreview(null)
        setCameraState('idle')
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

    const sendMessage = async (preset?: string, confirmed = false) => {
        const messageText = (preset ?? messageInput).trim()
        // Never send plaintext: wait until the key exchange has finished
        if (!messageText || !socket || !strangerId || !encryptionKeyRef.current) return
        // Pause before sharing personal details with a stranger
        const report = checkMessage(messageText)
        if (!confirmed && report.personal.length) {
            setPendingSend({ text: messageText, kinds: report.personal })
            return
        }
        setPendingSend(null)
        try {
            await sendPayload({ k: 'msg', t: messageText })
            setMessages((prev) => [...prev, { id: uuidv4(), text: messageText, sender: 'me' }])
            setMessageInput('')
            setShowEmojiPicker(false)
            typingSentRef.current = 0
        } catch (error) {
            console.error('Failed to encrypt message:', error)
        }
    }

    const idle = !isMatched && !isSearching

    return (
        <div className="grain relative min-h-screen bg-ink-900 text-paper">
            {/* Floating pill nav */}
            <header className={`${isMatched ? 'relative lg:sticky' : 'sticky'} top-0 z-40 px-3 sm:px-6 pt-3`}>
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
            <div className={isMatched ? 'mx-auto max-w-[1600px] px-3 sm:px-6 pt-4 sm:pt-5 pb-8 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-3 sm:gap-4 relative z-10' : 'relative z-10'}>
                <div className="flex flex-col gap-4 min-w-0">
                    <div className="relative">
                        <div
                    className={`video-container rounded-3xl relative cursor-pointer overflow-hidden transition-all duration-300 bg-black border border-paper/10`}
                    style={{
                        display: 'block', // Always block - never none (MediaStreams need visible parent)
                        opacity: isMatched ? '1' : '0', // Hide visually but keep in DOM
                        pointerEvents: isMatched ? 'auto' : 'none',
                        height: isMatched ? undefined : '0', // Collapse when not matched; CSS sizes it otherwise
                        minHeight: isMatched ? undefined : '0',
                        maxHeight: isMatched ? undefined : '0',
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
                            // iOS only delivers taps to elements that look clickable
                            cursor: isLocalMain ? 'pointer' : remoteVideoDragging ? 'grabbing' : remoteVideoZoom > 1 ? 'grab' : 'default'
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
                                    // Safe start: blurred until the viewer chooses to see the stranger
                                    filter: remoteHidden ? 'blur(36px) saturate(0.8)' : 'none',
                                    transition: 'filter 0.4s ease',
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
                                <div className="px-6 text-center">
                                    <p className="font-serif text-2xl">You are matched.</p>
                                    <p className="mt-2 text-sm text-paper-mute">Connecting video with your stranger. This takes a few seconds.</p>
                                    <p className="mt-1 text-xs text-paper-faint">You can already say hi in the chat.</p>
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
                                cursor: !isLocalMain ? 'pointer' : localVideoDragging ? 'grabbing' : localVideoZoom > 1 ? 'grab' : 'default'
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
                                    key={localPreview?.id ?? 'none'}
                                    ref={(el) => {
                                        localVideoRef.current = el
                                        // Attach the stream the moment the element exists, so it shows a frame immediately
                                        if (el && localPreview && el.srcObject !== localPreview) {
                                            el.srcObject = localPreview
                                            el.play().catch(() => {})
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover"
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
                        {isMatched && remoteHidden && !isLocalMain && !connIssue && (
                            <div className="absolute inset-0 z-[18] flex items-center justify-center bg-ink-900/30 animate-fade-in">
                                <div className="px-6 text-center">
                                    <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper-mute">Safe start</p>
                                    <p className="mt-2 font-serif text-2xl">Video hidden until you are ready</p>
                                    <button onClick={() => setRemoteHidden(false)} className="btn-primary mt-5 px-6 py-3 text-sm">
                                        Show video
                                    </button>
                                    <button onClick={() => toggleSafeStart(false)} className="mt-3 block w-full text-xs text-paper-faint underline-offset-4 hover:text-paper hover:underline">
                                        Always show strangers right away
                                    </button>
                                </div>
                            </div>
                        )}
                        {isMatched && (
                            <div className="absolute left-3.5 top-[3.25rem] z-30 animate-fade-in">
                                {selfHidden ? (
                                    <button onClick={showMe} className="flex items-center gap-2 rounded-full border border-glow/40 bg-black/55 py-1.5 pl-3 pr-1.5 text-[12px] text-paper backdrop-blur-md hover:border-glow/70">
                                        <span>You are blurred to them</span>
                                        <span className="rounded-full bg-paper px-2.5 py-1 text-[11.5px] font-medium text-ink-900">Show me</span>
                                    </button>
                                ) : (
                                    <button onClick={hideMe} className="rounded-full bg-black/45 px-3 py-1.5 text-[11.5px] text-paper-dim backdrop-blur-md hover:text-paper">
                                        Blur me
                                    </button>
                                )}
                            </div>
                        )}
                        {isMatched && connIssue && (
                            <div className="absolute inset-0 z-[26] flex items-center justify-center bg-ink-900/85 backdrop-blur-md animate-fade-in">
                                <div className="max-w-sm px-6 text-center">
                                    <p className="font-serif text-2xl">Video could not connect</p>
                                    <p className="mt-2 text-sm leading-relaxed text-paper-mute">
                                        Your networks are not letting the video through right now. This happens sometimes between countries or on mobile data.
                                    </p>
                                    <div className="mt-5 flex flex-col items-center gap-2">
                                        <button onClick={skipStranger} className="btn-primary px-6 py-3 text-sm">Find someone else</button>
                                        <button onClick={() => setConnIssue(false)} className="text-xs text-paper-faint underline-offset-4 hover:text-paper hover:underline">
                                            Keep waiting
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {isMatched && (
                            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
                                {floaters.map((f) => (
                                    <span key={f.id} className="floater absolute bottom-20 text-4xl" style={{ left: `${f.x}%` }}>
                                        {f.e}
                                    </span>
                                ))}
                            </div>
                        )}
                        {isMatched && (videoFilter !== 'none' || background !== 'none') && (
                            <div className="pointer-events-none absolute left-3.5 top-[5.5rem] z-30 rounded-full bg-black/45 backdrop-blur-md px-3 py-1 font-mono text-[10.5px] text-glow-soft animate-fade-in">
                                {[videoFilter !== 'none' ? FILTERS[videoFilter].label : null, background !== 'none' ? BACKGROUNDS.find((b) => b.id === background)?.label : null].filter(Boolean).join(' · ')}
                            </div>
                        )}
                        {isMatched && !isLocalMain && (
                            <div className="pointer-events-none absolute right-3.5 z-30 font-mono text-[9.5px] text-paper-dim/80 swap-hint" style={{ top: 'calc(14px + var(--pip-h) + 6px)', width: 'var(--pip-w)', textAlign: 'center' }}>
                                tap to swap
                            </div>
                        )}
                        {isMatched && (
                            <div className="pointer-events-none absolute left-3.5 top-3.5 z-30 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md px-3 py-1.5 font-mono text-[10.5px] text-paper-dim animate-fade-in">
                                <span className="h-1.5 w-1.5 rounded-full bg-glow breathe" />
                                <span className="hidden sm:inline">live · private · </span>encrypted
                            </div>
                        )}

                        {isMatched && (
                            <div className="absolute inset-x-0 bottom-3 sm:bottom-5 z-30 flex flex-col items-center gap-2 px-3 dock-in">
                                {openPanel === 'filters' && (
                                    <div className="w-full max-w-[420px] rounded-3xl border border-paper/10 bg-ink-900/80 backdrop-blur-xl p-2 animate-fade-in">
                                        <div className="flex items-center justify-between gap-2 px-1 pb-2">
                                            <div className="flex rounded-full bg-paper/5 p-0.5 text-[12.5px]">
                                                {([['face', 'Face'], ['background', 'Background'], ['privacy', 'Privacy']] as const).map(([id, label]) => (
                                                    <button
                                                        key={id}
                                                        onClick={() => {
                                                            setFilterTab(id)
                                                            // Warm up the engine this tab needs
                                                            if (id === 'face') ensureFaceTracker()
                                                            if (id === 'background') ensureSegmenter()
                                                        }}
                                                        className={`rounded-full px-3 py-1.5 transition ${filterTab === id ? 'bg-paper text-ink-900' : 'text-paper-dim hover:text-paper'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            {faceLoading && <span className="font-mono text-[10.5px] text-paper-faint">loading…</span>}
                                        </div>
                                        <PickerRail resetKey={filterTab}>
                                            {filterTab === 'background'
                                                ? BACKGROUNDS.map((b) => (
                                                      <PickerItem
                                                          key={b.id}
                                                          label={b.label}
                                                          active={background === b.id}
                                                          disabled={faceLoading}
                                                          onClick={() => (b.id === 'custom' ? bgInputRef.current?.click() : chooseBackground(b.id))}
                                                      >
                                                          {b.id === 'none' ? (
                                                              <OffGlyph />
                                                          ) : b.id === 'blur' ? (
                                                              <span className="h-full w-full rounded-full bg-gradient-to-br from-paper/40 to-paper/5 blur-[2px]" />
                                                          ) : b.id === 'custom' ? (
                                                              <span className="text-xl text-paper">+</span>
                                                          ) : (
                                                              // eslint-disable-next-line @next/next/no-img-element
                                                              <img src={sceneThumb(b.id)} alt="" className="h-full w-full rounded-full object-cover" />
                                                          )}
                                                      </PickerItem>
                                                  ))
                                                : (Object.keys(FILTERS) as VideoFilter[])
                                                      .filter((f) => f === 'none' || FILTERS[f].group === filterTab)
                                                      .map((f) => (
                                                          <PickerItem key={f} label={FILTERS[f].label} active={videoFilter === f} disabled={faceLoading} onClick={() => chooseFilter(f)}>
                                                              {f === 'none' ? <OffGlyph /> : <span className="text-[22px] leading-none">{FILTERS[f].thumb}</span>}
                                                          </PickerItem>
                                                      ))}
                                        </PickerRail>
                                        {filterTab === 'privacy' && (
                                            <div className="mt-2 space-y-1 border-t border-paper/10 px-2 pt-2">
                                                <PrivacyToggle label="Start every chat blurred" hint="They see you blurred until you tap Show me" on={startHidden} onChange={toggleStartHidden} />
                                                <PrivacyToggle label="Blur strangers until I tap" hint="Hide their video when a new chat starts" on={safeStart} onChange={toggleSafeStart} />
                                            </div>
                                        )}
                                        <input
                                            ref={bgInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                onBackgroundFile(e.target.files?.[0])
                                                e.target.value = ''
                                            }}
                                        />
                                    </div>
                                )}
                                {openPanel === 'react' && (
                                    <div className="flex gap-1 rounded-full border border-paper/10 bg-ink-900/75 backdrop-blur-xl p-1.5 animate-fade-in">
                                        {REACTIONS.map((e) => (
                                            <button
                                                key={e}
                                                onClick={() => sendReaction(e)}
                                                disabled={!chatReady}
                                                aria-label={`Send ${e}`}
                                                className="h-10 w-10 grid place-items-center rounded-full text-[22px] transition hover:bg-paper/10 hover:scale-110 active:scale-95 disabled:opacity-40"
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {openPanel === 'volume' && (
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
                                    <DockButton label="Filters and backgrounds" pressed={openPanel === 'filters' || videoFilter !== 'none' || background !== 'none'} onClick={() => {
                                            const opening = openPanel !== 'filters'
                                            setOpenPanel(opening ? 'filters' : 'none')
                                            // Warm up face tracking so choosing a filter feels instant
                                            if (opening && filterTab === 'face') ensureFaceTracker()
                                        }}>
                                        <Icon name="sparkle" />
                                    </DockButton>
                                    <DockButton label="React" pressed={openPanel === 'react'} onClick={() => setOpenPanel(openPanel === 'react' ? 'none' : 'react')}>
                                        <Icon name="smile" />
                                    </DockButton>
                                    <span className="hidden sm:contents">
                                        <DockButton label="Swap views" onClick={() => setIsLocalMain(!isLocalMain)}>
                                            <Icon name="swap" />
                                        </DockButton>
                                        <DockButton label="Volume" pressed={openPanel === 'volume'} onClick={() => setOpenPanel(openPanel === 'volume' ? 'none' : 'volume')}>
                                            <Icon name="speaker" />
                                        </DockButton>
                                    </span>
                                    <span className="mx-0.5 h-6 w-px bg-paper/15" aria-hidden="true" />
                                    <button
                                        onClick={disconnect}
                                        title="End conversation (Esc)"
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
                    <aside className="call-chat flex flex-col overflow-hidden rounded-3xl border border-paper/10 bg-gradient-to-b from-ink-850 to-ink-900 min-h-[360px]">
                        <div className="flex items-end justify-between gap-3 px-5 pt-4 pb-3">
                            <h2 className="font-serif text-2xl leading-none">Chat</h2>
                            <button
                                onClick={() => setShowSafety(!showSafety)}
                                aria-expanded={showSafety}
                                aria-label="Encryption details and safety code"
                                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition ${
                                    chatReady ? 'border-emerald-300/25 text-emerald-300/90 hover:border-emerald-300/50' : 'border-paper/10 text-paper-faint'
                                } ${showSafety ? 'bg-emerald-300/10' : ''}`}
                            >
                                <Icon name="lock" small />
                                {chatReady ? 'encrypted' : 'securing…'}
                                <span className="text-paper-faint">ⓘ</span>
                            </button>
                        </div>
                        {showSafety && (
                            <div className="mx-3 rounded-2xl border border-paper/10 bg-ink-950/60 p-4 animate-fade-in">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-paper-faint">Safety code</p>
                                        <p className="mt-1 font-mono text-2xl tracking-[0.18em] text-glow-soft">{safetyCode ?? '··· ···'}</p>
                                    </div>
                                    <button onClick={() => setShowSafety(false)} className="text-paper-faint hover:text-paper text-lg leading-none" aria-label="Close">
                                        ×
                                    </button>
                                </div>
                                <p className="mt-3 text-[12.5px] leading-relaxed text-paper-mute">
                                    Your video, voice and chat are end-to-end encrypted: only you and this person can see them, not us.
                                </p>
                                <p className="mt-2 text-[12.5px] leading-relaxed text-paper-mute">
                                    Want proof? Read this code aloud together. If both screens show the same digits, nobody is secretly in the middle of your call.
                                </p>
                            </div>
                        )}

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
                                const safety = msg.safety
                                const hideIt = !mine && safety?.offensive && !revealed.has(msg.id)
                                return (
                                    <div key={msg.id} className={`flex flex-col animate-fade-in ${mine ? 'items-end' : 'items-start'} ${grouped ? '' : 'pt-2'}`}>
                                        {hideIt ? (
                                            <button
                                                onClick={() => setRevealed((prev) => new Set(prev).add(msg.id))}
                                                className="max-w-[82%] rounded-[20px] rounded-bl-md border border-dashed border-paper/20 px-4 py-2.5 text-left text-[13px] text-paper-mute hover:border-paper/40"
                                            >
                                                Hidden: may contain offensive language. <span className="text-paper underline underline-offset-2">Show</span>
                                            </button>
                                        ) : (
                                            <div
                                                className={`max-w-[82%] break-words px-4 py-2.5 text-[14.5px] leading-snug ${
                                                    mine
                                                        ? 'rounded-[20px] rounded-br-md bg-paper text-ink-900 shadow-[0_6px_24px_-8px_rgba(236,233,226,0.35)]'
                                                        : 'rounded-[20px] rounded-bl-md border border-paper/10 bg-ink-700/70 text-paper'
                                                }`}
                                            >
                                                {/* Links are shown as plain text and are never clickable */}
                                                {splitLinks(msg.text).map((part, k) =>
                                                    part.link ? (
                                                        <span key={k} className={`break-all font-mono text-[13px] ${mine ? 'text-ink-900/70' : 'text-glow-soft/80'}`} title="Links are not clickable">
                                                            {part.text}
                                                        </span>
                                                    ) : (
                                                        <span key={k}>{part.text}</span>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                        {!mine && (safety?.links || safety?.risky) && (
                                            <p className="mt-1 flex max-w-[82%] items-start gap-1.5 px-1 text-[11px] leading-snug text-amber-200/80">
                                                <span aria-hidden="true">⚠</span>
                                                {safety?.links
                                                    ? 'Links are not clickable here. Never open links from people you just met.'
                                                    : 'Careful: asking for money or moving you to another app is how most scams start.'}
                                            </p>
                                        )}
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
                            {pendingSend && (
                                <div className="mb-2 rounded-2xl border border-amber-200/25 bg-amber-200/5 p-3 animate-fade-in">
                                    <p className="text-[12.5px] leading-snug text-paper-dim">
                                        This looks like your {pendingSend.kinds.join(' and ')}. Strangers can screenshot chats, so only share it if you trust them.
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <button type="button" onClick={() => setPendingSend(null)} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>
                                        <button type="button" onClick={() => sendMessage(pendingSend.text, true)} className="rounded-full bg-paper/10 px-3 py-1.5 text-xs text-paper hover:bg-paper/20">Send anyway</button>
                                    </div>
                                </div>
                            )}
                            {showEmojiPicker && (
                                <div className="mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-paper/10 bg-ink-950/80 p-2 animate-fade-in">
                                    {CHAT_EMOJIS.map((e) => (
                                        <button
                                            key={e}
                                            type="button"
                                            onClick={() => setMessageInput((v) => (v + e).slice(0, 2000))}
                                            className="h-9 grid place-items-center rounded-xl text-xl transition hover:bg-paper/10"
                                            aria-label={`Insert ${e}`}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-2 rounded-full border border-paper/10 bg-ink-950/70 p-1.5 pl-2 transition focus-within:border-paper/30 focus-within:shadow-[0_0_0_4px_rgba(236,233,226,0.04)]">
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`h-9 w-9 shrink-0 grid place-items-center rounded-full transition ${showEmojiPicker ? 'bg-paper/15 text-paper' : 'text-paper-mute hover:text-paper hover:bg-paper/10'}`}
                                    aria-label="Emoji"
                                    aria-expanded={showEmojiPicker}
                                >
                                    <Icon name="smile" />
                                </button>
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
                    {cameraState === 'asking' ? (
                        <div className="max-w-sm">
                            <p className="font-serif text-3xl">Allow your camera</p>
                            <p className="mt-3 text-paper-mute">Your browser will ask once. Nothing is uploaded to us: video goes straight to the person you meet.</p>
                        </div>
                    ) : (
                        <Orbit />
                    )}
                    <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-mute">Matching</p>
                    <h2 className="mt-3 font-serif text-4xl sm:text-5xl">
                        Finding <em className="text-glow-soft">someone new…</em>
                    </h2>
                    <p className="mt-4 max-w-sm text-paper-mute">
                        {slowSearch && (queueInfo?.searching ?? 1) <= 1
                            ? 'Nobody else is searching right now. Stay here and you will be connected the moment someone joins.'
                            : 'This usually takes a few seconds. Keep this tab open.'}
                    </p>
                    {queueInfo && (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-paper/10 px-3 py-1 font-mono text-[11px] text-paper-mute">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 breathe" />
                            {queueInfo.online} {queueInfo.online === 1 ? 'person' : 'people'} online
                        </p>
                    )}
                    {lastPeer && (
                        <div className="mt-8">
                            <RematchQuestion answer={rematchAnswer} onAnswer={answerRematch} />
                        </div>
                    )}
                    {cameraState === 'denied' && (
                        <p className="mt-6 max-w-sm text-sm text-danger">
                            Camera access was blocked. Allow it in your browser&apos;s site settings, then press Start again.
                        </p>
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
                        <button
                            onClick={() => {
                                setAutoNext(null)
                                setCallEnded(null)
                            }}
                            className="btn-ghost px-6 py-3.5 text-[15px]"
                        >
                            Back to home
                        </button>
                    </div>
                    {autoNext !== null && (
                        <p className="mt-6 text-sm text-paper-mute animate-fade-in">
                            Finding someone new in <span className="font-mono text-paper">{autoNext}</span>…{' '}
                            <button onClick={() => setAutoNext(null)} className="text-paper underline underline-offset-4 hover:text-glow-soft">
                                Cancel
                            </button>
                        </p>
                    )}
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

// Horizontal picker with arrow buttons that appear only when there is more to see
function PickerRail({ children, resetKey }: { children: React.ReactNode; resetKey: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const [edges, setEdges] = useState({ left: false, right: false })
    const update = () => {
        const el = ref.current
        if (!el) return
        setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
    }
    useEffect(() => {
        ref.current?.scrollTo({ left: 0 })
        update()
        const el = ref.current
        if (!el) return
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [resetKey])
    const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.7), behavior: 'smooth' })
    const Arrow = ({ dir }: { dir: 1 | -1 }) => (
        <button
            onClick={() => page(dir)}
            aria-label={dir < 0 ? 'Previous' : 'Next'}
            className={`absolute top-[20px] z-10 grid h-8 w-8 place-items-center rounded-full border border-paper/15 bg-ink-900/90 text-paper shadow-lg backdrop-blur transition hover:bg-paper hover:text-ink-900 ${dir < 0 ? 'left-0.5' : 'right-0.5'}`}
        >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
            </svg>
        </button>
    )
    return (
        <div className="relative">
            {edges.left && <Arrow dir={-1} />}
            <div ref={ref} onScroll={update} className="picker-rail flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scrollbar-none px-3 pb-1 pt-1">
                {children}
            </div>
            {edges.right && <Arrow dir={1} />}
        </div>
    )
}

function PrivacyToggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-paper/5" role="switch" aria-checked={on}>
            <span>
                <span className="block text-[12.5px] text-paper">{label}</span>
                <span className="block text-[11px] text-paper-faint">{hint}</span>
            </span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-emerald-400/80' : 'bg-paper/15'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
        </button>
    )
}

function PickerItem({ label, active, disabled, onClick, children }: { label: string; active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} disabled={disabled} className="group flex w-[58px] shrink-0 snap-center flex-col items-center gap-1.5 disabled:opacity-50" aria-pressed={active}>
            <span className={`picker-ring grid h-[54px] w-[54px] place-items-center rounded-full p-[2px] transition-transform duration-300 ${active ? 'is-active scale-105' : 'group-hover:scale-105'}`}>
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-ink-800">{children}</span>
            </span>
            <span className={`w-full truncate text-center text-[10.5px] ${active ? 'text-paper' : 'text-paper-mute'}`}>{label}</span>
        </button>
    )
}

function OffGlyph() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-paper-dim" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <path d="M6.5 17.5l11-11" />
        </svg>
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

function Icon({ name, small }: { name: 'mic' | 'micOff' | 'cam' | 'camOff' | 'speaker' | 'next' | 'end' | 'flag' | 'lock' | 'send' | 'swap' | 'smile' | 'sparkle'; small?: boolean }) {
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
        swap: <><path d="M7 7h11l-3-3M17 17H6l3 3" /></>,
        smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14c1.8 2 5.2 2 7 0M9.3 9.8h.01M14.7 9.8h.01" /></>,
        sparkle: <><path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 3.5Z" /><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" /></>,
    }
    return (
        <svg viewBox="0 0 24 24" className={small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {p[name]}
        </svg>
    )
}
