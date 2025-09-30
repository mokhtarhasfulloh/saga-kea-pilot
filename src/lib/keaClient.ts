export type KeaService = 'dhcp4' | 'dhcp6'

export interface KeaReply<T = any> {
  result: number
  text?: string
  arguments?: T
}

export async function caCall<T = any>(
  command: string,
  service: KeaService = 'dhcp4',
  args: Record<string, any> = {}
): Promise<KeaReply<T>> {
  const payload = [{ command, service: [service], arguments: args }]
  const res = await fetch('/ca/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`CA HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error('Unexpected CA response')
  return data[0] as KeaReply<T>
}

export const keaVersion = () => caCall('version-get')
export const keaConfig = () => caCall('config-get')
export const lease4GetAll = (limit = 50, offset = 0) => caCall('lease4-get-all', 'dhcp4', { limit, offset })

