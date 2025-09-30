export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) throw new Error('Invalid IPv4')
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

export function parsePool(pool: string): [number, number] {
  const [a, b] = pool.split('-')
  if (!a || !b) throw new Error('Pool must be start-end')
  const A = ipToInt(a.trim()); const B = ipToInt(b.trim())
  if (A > B) throw new Error('Pool start must be <= end')
  return [A, B]
}

export function cidrRange(cidr: string): [number, number] {
  const [ip, maskStr] = cidr.split('/')
  const mask = Number(maskStr)
  if (!ip || isNaN(mask) || mask < 0 || mask > 32) throw new Error('Invalid CIDR')
  const base = ipToInt(ip)
  const netmask = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1) >>> 0)
  const network = base & netmask
  const broadcast = network + ((~netmask) >>> 0)
  return [network >>> 0, broadcast >>> 0]
}

export function poolWithinCidr(pool: string, cidr: string): boolean {
  const [A, B] = parsePool(pool)
  const [N, X] = cidrRange(cidr)
  return A >= N && B <= X
}

export function poolsOverlap(pools: string[]): boolean {
  const ranges = pools.map(parsePool).sort((p, q) => p[0] - q[0])
  for (let i = 1; i < ranges.length; i++) { if (ranges[i][0] <= ranges[i-1][1]) return true }
  return false
}

