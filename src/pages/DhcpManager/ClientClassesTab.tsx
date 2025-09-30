import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import { Alert } from '../../components/ui/alert'
import ClientClassManager from '../../components/dhcp/ClientClassManager'

interface ClientClass {
  name: string
  test: string
  'option-data'?: Array<{
    name?: string
    code?: number
    data: string
  }>
  'only-if-required'?: boolean
  'boot-file-name'?: string
  'server-hostname'?: string
  'next-server'?: string
}

interface Pool {
  pool: string
  'client-class'?: string
  'require-client-classes'?: string[]
}

export default function ClientClassesTab() {
  const [classes, setClasses] = useState<ClientClass[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || config
      
      setClasses(dhcp4['client-classes'] || [])
      
      // Collect all pools from subnets and shared networks
      const allPools: Pool[] = []
      
      // Pools from standalone subnets
      if (dhcp4.subnet4) {
        for (const subnet of dhcp4.subnet4) {
          if (subnet.pools) {
            allPools.push(...subnet.pools)
          }
        }
      }
      
      // Pools from shared networks
      if (dhcp4['shared-networks']) {
        for (const network of dhcp4['shared-networks']) {
          if (network.subnet4) {
            for (const subnet of network.subnet4) {
              if (subnet.pools) {
                allPools.push(...subnet.pools)
              }
            }
          }
        }
      }
      
      setPools(allPools)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function updateClasses(newClasses: ClientClass[]) {
    setSaving(true)
    setError('')
    try {
      const config = await Kea.configGet()
      const dhcp4 = config?.Dhcp4 || config
      
      const updatedConfig = {
        ...dhcp4,
        'client-classes': newClasses.length > 0 ? newClasses : undefined
      }

      await Kea.action('config-set', { Dhcp4: updatedConfig })
      await Kea.action('config-write')
      
      setClasses(newClasses)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function updatePools(newPools: Pool[]) {
    setSaving(true)
    setError('')
    try {
      // const config = await Kea.configGet()
      // const dhcp4 = config?.Dhcp4 || config
      
      // This is a simplified update - in a real implementation,
      // we'd need to update the specific subnets/shared networks
      // that contain these pools. For now, we'll just update the state.
      setPools(newPools)
      
      // Note: Full implementation would require mapping pools back to their
      // parent subnets and updating the complete configuration
      console.log('Pool updates would be applied to parent subnets:', newPools)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading client classes...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Client Classes</h2>
        <p className="text-sm text-gray-600">
          Manage client classification rules and pool assignments for conditional DHCP behavior
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <ClientClassManager
        classes={classes}
        pools={pools}
        onUpdateClasses={updateClasses}
        onUpdatePools={updatePools}
        disabled={saving}
      />

      {/* Usage Examples */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Client Class Usage Examples</h3>
        <div className="text-sm text-blue-700 space-y-2">
          <div>
            <strong>Vendor-specific pools:</strong> Create classes based on vendor class identifier (option 60) 
            to assign different IP ranges to different device types.
          </div>
          <div>
            <strong>PXE boot classification:</strong> Use user class (option 77) to identify PXE clients 
            and provide appropriate boot options.
          </div>
          <div>
            <strong>MAC-based classification:</strong> Create classes based on MAC address prefixes 
            to handle different hardware vendors.
          </div>
          <div>
            <strong>Relay-based classification:</strong> Use relay agent information (option 82) 
            to classify clients based on their network location.
          </div>
        </div>
      </div>

      {/* Configuration Notes */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="font-medium text-yellow-800 mb-2">Configuration Notes</h3>
        <div className="text-sm text-yellow-700 space-y-1">
          <div>• Client classes are evaluated in the order they are defined</div>
          <div>• Use "only-if-required" for expensive evaluations that should only run when needed</div>
          <div>• Pool-level client classes restrict which clients can use that pool</div>
          <div>• Required client classes must all match for a client to use a pool</div>
          <div>• Test expressions use Kea's expression syntax - see documentation for details</div>
        </div>
      </div>
    </div>
  )
}
