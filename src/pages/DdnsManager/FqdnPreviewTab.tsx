import { useState } from 'react'
import Button from '../../components/ui/button'
import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Tbody, Tr, Td } from '../../components/ui/table'

interface FqdnPreview {
  client_id: string
  hostname: string
  ip_address: string
  forward_fqdn: string
  reverse_fqdn: string
  forward_update: string
  reverse_update: string
  conflicts: string[]
}

export default function FqdnPreviewTab() {
  const [clientId, setClientId] = useState('')
  const [hostname, setHostname] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [domainName, setDomainName] = useState('example.com')
  const [preview, setPreview] = useState<FqdnPreview | null>(null)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  function generatePreview() {
    if (!clientId.trim() && !hostname.trim()) {
      setError('Either Client ID or Hostname is required')
      return
    }

    if (!ipAddress.trim()) {
      setError('IP Address is required')
      return
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ipAddress)) {
      setError('Invalid IP address format')
      return
    }

    setGenerating(true)
    setError('')

    try {
      // Generate FQDN based on configuration
      let effectiveHostname = hostname.trim()
      if (!effectiveHostname && clientId.trim()) {
        // Generate hostname from client ID if not provided
        effectiveHostname = clientId.trim().replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
      }

      const forwardFqdn = `${effectiveHostname}.${domainName}`
      
      // Generate reverse FQDN
      const ipParts = ipAddress.split('.').reverse()
      const reverseFqdn = `${ipParts.join('.')}.in-addr.arpa`

      // Generate DNS update commands
      const forwardUpdate = `server ${domainName}
update delete ${forwardFqdn} A
update add ${forwardFqdn} 3600 A ${ipAddress}
send`

      const reverseUpdate = `server in-addr.arpa
update delete ${reverseFqdn} PTR
update add ${reverseFqdn} 3600 PTR ${forwardFqdn}
send`

      // Check for potential conflicts
      const conflicts: string[] = []
      if (effectiveHostname.length > 63) {
        conflicts.push('Hostname exceeds 63 character limit')
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(effectiveHostname)) {
        conflicts.push('Hostname contains invalid characters')
      }
      if (forwardFqdn.length > 253) {
        conflicts.push('FQDN exceeds 253 character limit')
      }

      const previewResult: FqdnPreview = {
        client_id: clientId.trim(),
        hostname: effectiveHostname,
        ip_address: ipAddress,
        forward_fqdn: forwardFqdn,
        reverse_fqdn: reverseFqdn,
        forward_update: forwardUpdate,
        reverse_update: reverseUpdate,
        conflicts
      }

      setPreview(previewResult)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  function clearPreview() {
    setPreview(null)
    setClientId('')
    setHostname('')
    setIpAddress('')
    setError('')
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard`)
    }).catch(() => {
      alert('Failed to copy to clipboard')
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">FQDN Preview & DNS Updates</h2>
        <p className="text-sm text-gray-600">
          Preview how client hostnames will be converted to FQDNs and DNS updates
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Input Form */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Generate FQDN Preview</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Client ID
              </label>
              <Input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="01:23:45:67:89:ab"
                disabled={generating}
              />
              <div className="text-xs text-gray-500 mt-1">
                MAC address or client identifier
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Hostname (optional)
              </label>
              <Input
                value={hostname}
                onChange={e => setHostname(e.target.value)}
                placeholder="client-001"
                disabled={generating}
              />
              <div className="text-xs text-gray-500 mt-1">
                Client-provided hostname (if available)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                IP Address *
              </label>
              <Input
                value={ipAddress}
                onChange={e => setIpAddress(e.target.value)}
                placeholder="192.168.1.100"
                disabled={generating}
              />
              <div className="text-xs text-gray-500 mt-1">
                Assigned IP address
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Domain Name
              </label>
              <Input
                value={domainName}
                onChange={e => setDomainName(e.target.value)}
                placeholder="example.com"
                disabled={generating}
              />
              <div className="text-xs text-gray-500 mt-1">
                DNS domain for FQDN generation
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={generatePreview} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Preview'}
            </Button>
            {preview && (
              <Button variant="outline" onClick={clearPreview} disabled={generating}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {preview && (
        <>
          {/* FQDN Summary */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">FQDN Generation Results</h3>
            </CardHeader>
            <CardContent>
              <Table>
                <Tbody>
                  <Tr>
                    <Td className="font-medium">Client ID</Td>
                    <Td className="font-mono">{preview.client_id || 'N/A'}</Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium">Generated Hostname</Td>
                    <Td className="font-mono">{preview.hostname}</Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium">IP Address</Td>
                    <Td className="font-mono">{preview.ip_address}</Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium">Forward FQDN</Td>
                    <Td className="font-mono text-blue-600">{preview.forward_fqdn}</Td>
                  </Tr>
                  <Tr>
                    <Td className="font-medium">Reverse FQDN</Td>
                    <Td className="font-mono text-purple-600">{preview.reverse_fqdn}</Td>
                  </Tr>
                </Tbody>
              </Table>
            </CardContent>
          </Card>

          {/* Conflicts Warning */}
          {preview.conflicts.length > 0 && (
            <Alert variant="error">
              <div className="font-medium mb-2">FQDN Generation Conflicts:</div>
              <ul className="list-disc list-inside space-y-1">
                {preview.conflicts.map((conflict, i) => (
                  <li key={i}>{conflict}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* DNS Update Commands */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Forward DNS Update</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(preview.forward_update, 'Forward DNS update')}
                  >
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                  {preview.forward_update}
                </pre>
                <div className="text-xs text-gray-500 mt-2">
                  nsupdate command for forward DNS (A record)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Reverse DNS Update</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(preview.reverse_update, 'Reverse DNS update')}
                  >
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-3 rounded text-sm font-mono overflow-x-auto">
                  {preview.reverse_update}
                </pre>
                <div className="text-xs text-gray-500 mt-2">
                  nsupdate command for reverse DNS (PTR record)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DNS Record Preview */}
          <Card>
            <CardHeader>
              <h3 className="font-medium">Resulting DNS Records</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-blue-600 mb-1">Forward Record (A)</div>
                  <div className="bg-blue-50 p-3 rounded font-mono text-sm">
                    {preview.forward_fqdn}. 3600 IN A {preview.ip_address}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-purple-600 mb-1">Reverse Record (PTR)</div>
                  <div className="bg-purple-50 p-3 rounded font-mono text-sm">
                    {preview.reverse_fqdn}. 3600 IN PTR {preview.forward_fqdn}.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* FQDN Preview Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">FQDN Preview Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Hostname Generation:</strong> Uses client hostname or generates from client ID</div>
          <div>• <strong>Forward FQDN:</strong> hostname.domain format for A record</div>
          <div>• <strong>Reverse FQDN:</strong> IP octets reversed + .in-addr.arpa for PTR record</div>
          <div>• <strong>DNS Updates:</strong> nsupdate commands that will be sent to DNS server</div>
          <div>• <strong>Validation:</strong> Checks for RFC compliance and length limits</div>
          <div>• <strong>Testing:</strong> Use this tool to verify DDNS configuration before deployment</div>
        </div>
      </div>
    </div>
  )
}
