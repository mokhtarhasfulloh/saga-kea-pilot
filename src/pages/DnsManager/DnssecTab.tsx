import { useEffect, useState } from 'react'
import { DnsApi } from '../../lib/dnsApi'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'
import { RoleGuard } from '../../components/RoleGuard'

interface DnssecKey {
  id: string
  zoneName: string
  keyType: 'KSK' | 'ZSK'
  algorithm: string
  keySize: number
  keyTag: number
  status: 'active' | 'inactive' | 'revoked'
  createdAt: string
  expiresAt?: string
  publicKey: string
  dsRecord?: string
}

interface DnssecStatus {
  zoneName: string
  enabled: boolean
  signed: boolean
  validationStatus: 'valid' | 'invalid' | 'unknown'
  lastSigned?: string
  nextResign?: string
  keyCount: number
  issues: string[]
}

interface SigningPolicy {
  zoneName: string
  autoSign: boolean
  resignInterval: number // days
  keyRotationInterval: number // days
  algorithm: string
  kskKeySize: number
  zskKeySize: number
  nsec3: boolean
  nsec3Salt?: string
}

export default function DnssecTab() {
  const [zones, setZones] = useState<string[]>([])
  const [dnssecKeys, setDnssecKeys] = useState<DnssecKey[]>([])
  const [dnssecStatus, setDnssecStatus] = useState<DnssecStatus[]>([])
  const [signingPolicies, setSigningPolicies] = useState<SigningPolicy[]>([])
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [showKeyGenForm, setShowKeyGenForm] = useState(false)
  const [showPolicyForm, setShowPolicyForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const toast = useToast()

  const [keyGenForm, setKeyGenForm] = useState({
    zoneName: '',
    keyType: 'ZSK' as 'KSK' | 'ZSK',
    algorithm: 'RSASHA256',
    keySize: 2048
  })

  const [policyForm, setPolicyForm] = useState<SigningPolicy>({
    zoneName: '',
    autoSign: true,
    resignInterval: 30,
    keyRotationInterval: 365,
    algorithm: 'RSASHA256',
    kskKeySize: 2048,
    zskKeySize: 1024,
    nsec3: false,
    nsec3Salt: ''
  })

  const loadDnssecData = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Load available zones
      const zonesResponse = await DnsApi.getZones()
      setZones(zonesResponse.zones.map(z => z.name))
      
      // Mock DNSSEC data (would be from API)
      const mockKeys: DnssecKey[] = [
        {
          id: 'key-1',
          zoneName: 'example.com',
          keyType: 'KSK',
          algorithm: 'RSASHA256',
          keySize: 2048,
          keyTag: 12345,
          status: 'active',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          expiresAt: new Date(Date.now() + 31536000000).toISOString(),
          publicKey: 'AwEAAcXYYX...',
          dsRecord: '12345 8 2 A1B2C3D4...'
        },
        {
          id: 'key-2',
          zoneName: 'example.com',
          keyType: 'ZSK',
          algorithm: 'RSASHA256',
          keySize: 1024,
          keyTag: 54321,
          status: 'active',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          expiresAt: new Date(Date.now() + 7776000000).toISOString(),
          publicKey: 'AwEAAaXYYX...'
        }
      ]
      setDnssecKeys(mockKeys)
      
      const mockStatus: DnssecStatus[] = [
        {
          zoneName: 'example.com',
          enabled: true,
          signed: true,
          validationStatus: 'valid',
          lastSigned: new Date(Date.now() - 3600000).toISOString(),
          nextResign: new Date(Date.now() + 2592000000).toISOString(),
          keyCount: 2,
          issues: []
        },
        {
          zoneName: 'test.local',
          enabled: false,
          signed: false,
          validationStatus: 'unknown',
          keyCount: 0,
          issues: ['DNSSEC not enabled']
        }
      ]
      setDnssecStatus(mockStatus)
      
      const mockPolicies: SigningPolicy[] = [
        {
          zoneName: 'example.com',
          autoSign: true,
          resignInterval: 30,
          keyRotationInterval: 365,
          algorithm: 'RSASHA256',
          kskKeySize: 2048,
          zskKeySize: 1024,
          nsec3: false
        }
      ]
      setSigningPolicies(mockPolicies)
      
    } catch (err: any) {
      setError(err.message || 'Failed to load DNSSEC data')
    } finally {
      setLoading(false)
    }
  }

  const generateKey = async () => {
    try {
      if (!keyGenForm.zoneName) {
        toast.error('Validation Error', 'Please select a zone')
        return
      }
      
      // This would call the API to generate a new DNSSEC key
      const newKey: DnssecKey = {
        id: `key-${Date.now()}`,
        zoneName: keyGenForm.zoneName,
        keyType: keyGenForm.keyType,
        algorithm: keyGenForm.algorithm,
        keySize: keyGenForm.keySize,
        keyTag: Math.floor(Math.random() * 65535),
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (keyGenForm.keyType === 'KSK' ? 31536000000 : 7776000000)).toISOString(),
        publicKey: 'AwEAAaXYYX...',
        ...(keyGenForm.keyType === 'KSK' && { dsRecord: `${Math.floor(Math.random() * 65535)} 8 2 A1B2C3D4...` })
      }
      
      setDnssecKeys(prev => [...prev, newKey])
      setShowKeyGenForm(false)
      setKeyGenForm({
        zoneName: '',
        keyType: 'ZSK',
        algorithm: 'RSASHA256',
        keySize: 2048
      })
      
      toast.success('Key Generated', `${keyGenForm.keyType} key generated for ${keyGenForm.zoneName}`)
      
    } catch (error: any) {
      toast.error('Key Generation Failed', error.message || 'Failed to generate DNSSEC key')
    }
  }

  const signZone = async (zoneName: string) => {
    try {
      // This would call the API to sign the zone
      toast.success('Zone Signing Started', `DNSSEC signing initiated for ${zoneName}`)
      
      // Update status
      setDnssecStatus(prev => prev.map(status => 
        status.zoneName === zoneName 
          ? { 
              ...status, 
              signed: true, 
              lastSigned: new Date().toISOString(),
              nextResign: new Date(Date.now() + 2592000000).toISOString()
            }
          : status
      ))
      
    } catch (error: any) {
      toast.error('Zone Signing Failed', error.message || 'Failed to sign zone')
    }
  }

  const revokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) return
    
    try {
      setDnssecKeys(prev => prev.map(key => 
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      ))
      
      toast.success('Key Revoked', 'DNSSEC key has been revoked')
      
    } catch (error: any) {
      toast.error('Key Revocation Failed', error.message || 'Failed to revoke key')
    }
  }

  const enableDnssec = async (zoneName: string) => {
    try {
      // This would call the API to enable DNSSEC for the zone
      setDnssecStatus(prev => prev.map(status => 
        status.zoneName === zoneName 
          ? { ...status, enabled: true, issues: [] }
          : status
      ))
      
      toast.success('DNSSEC Enabled', `DNSSEC has been enabled for ${zoneName}`)
      
    } catch (error: any) {
      toast.error('DNSSEC Enable Failed', error.message || 'Failed to enable DNSSEC')
    }
  }

  const disableDnssec = async (zoneName: string) => {
    if (!confirm(`Are you sure you want to disable DNSSEC for ${zoneName}? This will remove all signatures.`)) return
    
    try {
      setDnssecStatus(prev => prev.map(status => 
        status.zoneName === zoneName 
          ? { ...status, enabled: false, signed: false, issues: ['DNSSEC disabled'] }
          : status
      ))
      
      toast.success('DNSSEC Disabled', `DNSSEC has been disabled for ${zoneName}`)
      
    } catch (error: any) {
      toast.error('DNSSEC Disable Failed', error.message || 'Failed to disable DNSSEC')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-600 bg-green-100'
      case 'invalid': return 'text-red-600 bg-red-100'
      case 'unknown': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getKeyStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-yellow-600 bg-yellow-100'
      case 'revoked': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  useEffect(() => {
    loadDnssecData()
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-600">Loading DNSSEC data...</div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p className="mb-4">Failed to load DNSSEC data: {error}</p>
          <Button onClick={loadDnssecData} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const filteredKeys = selectedZone 
    ? dnssecKeys.filter(key => key.zoneName === selectedZone)
    : dnssecKeys

  const filteredStatus = selectedZone 
    ? dnssecStatus.filter(status => status.zoneName === selectedZone)
    : dnssecStatus

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">DNSSEC Management</h3>
        <div className="flex gap-2">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Zones</option>
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
          <Button onClick={loadDnssecData} variant="outline" size="sm">
            Refresh
          </Button>
          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
            <Button onClick={() => setShowKeyGenForm(true)} size="sm">
              Generate Key
            </Button>
          </RoleGuard>
        </div>
      </div>

      {/* DNSSEC Status Overview */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">DNSSEC Status</h4>
        
        {filteredStatus.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No zones found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Signed</th>
                  <th className="text-left p-3 font-medium">Validation</th>
                  <th className="text-left p-3 font-medium">Keys</th>
                  <th className="text-left p-3 font-medium">Last Signed</th>
                  <th className="text-left p-3 font-medium">Next Resign</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatus.map((status) => (
                  <tr key={status.zoneName} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm">{status.zoneName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        status.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {status.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        status.signed ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {status.signed ? 'Signed' : 'Unsigned'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(status.validationStatus)}`}>
                        {status.validationStatus}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{status.keyCount}</td>
                    <td className="p-3 text-sm">
                      {status.lastSigned 
                        ? new Date(status.lastSigned).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-3 text-sm">
                      {status.nextResign 
                        ? new Date(status.nextResign).toLocaleDateString()
                        : 'N/A'
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {!status.enabled ? (
                          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => enableDnssec(status.zoneName)}
                            >
                              Enable
                            </Button>
                          </RoleGuard>
                        ) : (
                          <>
                            <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => signZone(status.zoneName)}
                              >
                                Sign
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => disableDnssec(status.zoneName)}
                                className="text-red-600"
                              >
                                Disable
                              </Button>
                            </RoleGuard>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DNSSEC Keys */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">DNSSEC Keys</h4>

        {filteredKeys.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No DNSSEC keys found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Algorithm</th>
                  <th className="text-left p-3 font-medium">Key Size</th>
                  <th className="text-left p-3 font-medium">Key Tag</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-left p-3 font-medium">Expires</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((key) => (
                  <tr key={key.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-sm">{key.zoneName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        key.keyType === 'KSK' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {key.keyType}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{key.algorithm}</td>
                    <td className="p-3 text-sm">{key.keySize}</td>
                    <td className="p-3 font-mono text-sm">{key.keyTag}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getKeyStatusColor(key.status)}`}>
                        {key.status}
                      </span>
                    </td>
                    <td className="p-3 text-sm">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-sm">
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        {key.status === 'active' && (
                          <RoleGuard requiredPermission="canWrite" hideIfNoAccess>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeKey(key.id)}
                              className="text-red-600"
                            >
                              Revoke
                            </Button>
                          </RoleGuard>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Key Generation Form Modal */}
      {showKeyGenForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Generate DNSSEC Key</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowKeyGenForm(false)}>
                ×
              </Button>
            </div>

            <div className="space-y-4">
              {/* Zone Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Zone *</label>
                <select
                  value={keyGenForm.zoneName}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, zoneName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a zone</option>
                  {zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              {/* Key Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Key Type</label>
                <select
                  value={keyGenForm.keyType}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, keyType: e.target.value as 'KSK' | 'ZSK' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ZSK">ZSK (Zone Signing Key)</option>
                  <option value="KSK">KSK (Key Signing Key)</option>
                </select>
              </div>

              {/* Algorithm */}
              <div>
                <label className="block text-sm font-medium mb-1">Algorithm</label>
                <select
                  value={keyGenForm.algorithm}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, algorithm: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="RSASHA256">RSA/SHA-256</option>
                  <option value="RSASHA512">RSA/SHA-512</option>
                  <option value="ECDSAP256SHA256">ECDSA P-256/SHA-256</option>
                  <option value="ECDSAP384SHA384">ECDSA P-384/SHA-384</option>
                  <option value="ED25519">Ed25519</option>
                </select>
              </div>

              {/* Key Size */}
              <div>
                <label className="block text-sm font-medium mb-1">Key Size (bits)</label>
                <select
                  value={keyGenForm.keySize}
                  onChange={(e) => setKeyGenForm(prev => ({ ...prev, keySize: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={keyGenForm.algorithm.startsWith('ECDSA') || keyGenForm.algorithm === 'ED25519'}
                >
                  <option value={1024}>1024</option>
                  <option value={2048}>2048</option>
                  <option value={4096}>4096</option>
                </select>
                {(keyGenForm.algorithm.startsWith('ECDSA') || keyGenForm.algorithm === 'ED25519') && (
                  <p className="text-xs text-gray-500 mt-1">Key size is fixed for this algorithm</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowKeyGenForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={generateKey}
                  disabled={!keyGenForm.zoneName}
                  className="flex-1"
                >
                  Generate Key
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
