type Listener = (msg: any) => void

export interface WsOptions {
  url?: string
  protocols?: string | string[]
  reconnectDelayMs?: number
}

export class WsClient {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private closedByUser = false
  private url: string
  private protocols?: string | string[]
  private reconnectDelayMs: number

  constructor(opts: WsOptions = {}) {
    this.url = opts.url || (import.meta.env.VITE_WS_URL as string) || (location.origin.replace(/^http/, 'ws') + '/ws')
    this.protocols = opts.protocols
    this.reconnectDelayMs = opts.reconnectDelayMs ?? 2000
    this.connect()
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url, this.protocols)
      this.ws.onopen = () => {/* noop */}
      this.ws.onmessage = (ev) => {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          this.listeners.forEach(l => l(data))
        } catch (e) {
          // pass raw string if not JSON
          this.listeners.forEach(l => l(ev.data))
        }
      }
      this.ws.onclose = () => {
        if (!this.closedByUser) setTimeout(() => this.connect(), this.reconnectDelayMs)
      }
      this.ws.onerror = () => {
        try { this.ws?.close() } catch {}
      }
    } catch {
      setTimeout(() => this.connect(), this.reconnectDelayMs)
    }
  }

  send(obj: any) { this.ws?.readyState === WebSocket.OPEN && this.ws.send(JSON.stringify(obj)) }
  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l) }
  close() { this.closedByUser = true; try { this.ws?.close() } catch {} }
}

export function subscribeWs(topic: string, onMessage: Listener) {
  const client = new WsClient()
  const off = client.on((msg) => {
    if (msg && typeof msg === 'object' && (msg.topic === topic || msg.type === topic)) onMessage(msg)
  })
  client.send({ action: 'subscribe', topic })
  return () => { off(); client.close() }
}

