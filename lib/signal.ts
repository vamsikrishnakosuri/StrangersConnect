// Tiny WebSocket client for the signaling server, with the same on/emit shape the
// page used with socket.io. Reconnects with backoff when the connection drops.

type Handler = (data: any) => void

export class Signal {
    private ws: WebSocket | null = null
    private handlers = new Map<string, Set<Handler>>()
    private retry = 0
    private closedByUser = false
    private timer: ReturnType<typeof setTimeout> | null = null
    connected = false

    constructor(private url: string) {
        this.open()
    }

    private open() {
        const ws = new WebSocket(this.url)
        this.ws = ws
        ws.onopen = () => {
            this.retry = 0
            this.connected = true
            this.fire('connect', {})
        }
        ws.onmessage = (e) => {
            if (typeof e.data !== 'string') return
            try {
                const { t, d } = JSON.parse(e.data)
                if (typeof t === 'string') this.fire(t, d ?? {})
            } catch {
                // ignore malformed frames
            }
        }
        ws.onclose = (e) => {
            const wasConnected = this.connected
            this.connected = false
            if (wasConnected) this.fire('disconnect', {})
            // 4003 = banned; do not hammer the server
            if (this.closedByUser || e.code === 4003) return
            const delay = Math.min(15000, 500 * 2 ** this.retry++) + Math.random() * 500
            this.timer = setTimeout(() => this.open(), delay)
        }
    }

    private fire(event: string, data: unknown) {
        this.handlers.get(event)?.forEach((h) => h(data))
    }

    on(event: string, handler: Handler) {
        if (!this.handlers.has(event)) this.handlers.set(event, new Set())
        this.handlers.get(event)!.add(handler)
        return this
    }

    emit(event: string, data: unknown = {}) {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: event, d: data }))
    }

    close() {
        this.closedByUser = true
        if (this.timer) clearTimeout(this.timer)
        this.ws?.close(1000)
    }

    disconnect() {
        this.close()
    }
}

// Random per-browser ID used only so "don't match me with them again" and bans can
// work across visits. It never leaves this browser except to the server, which keeps
// only a salted one-way hash of it. Clearing site data resets it.
export function deviceId(): string {
    const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('')
    try {
        let id = localStorage.getItem('sc-device')
        if (!id || !/^[0-9a-f]{32}$/.test(id)) {
            id = fresh()
            localStorage.setItem('sc-device', id)
        }
        return id
    } catch {
        return fresh()
    }
}
