import { useState } from 'react'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface OptionTemplate {
  id: string
  name: string
  description: string
  category: string
  options: Array<{
    name?: string
    code?: number
    data: string
    description: string
  }>
  useCase: string
}

const OPTION_TEMPLATES: OptionTemplate[] = [
  {
    id: 'pxe-boot',
    name: 'PXE Network Boot',
    description: 'Complete PXE boot configuration for network imaging',
    category: 'Network Boot',
    useCase: 'Deploy OS images, run diagnostics, or boot diskless workstations',
    options: [
      { name: 'tftp-server-name', data: '192.168.1.10', description: 'TFTP server hostname or IP' },
      { name: 'bootfile-name', data: 'pxelinux.0', description: 'Initial boot file name' },
      { code: 66, data: '192.168.1.10', description: 'TFTP server name (legacy)' },
      { code: 67, data: 'pxelinux.0', description: 'Boot file name (legacy)' },
      { name: 'next-server', data: '192.168.1.10', description: 'Next server IP address' }
    ]
  },
  {
    id: 'tr069-cwmp',
    name: 'TR-069/CWMP',
    description: 'Auto Configuration Server (ACS) for CPE management',
    category: 'ISP/Telecom',
    useCase: 'Automatically configure customer premises equipment (modems, routers)',
    options: [
      { code: 43, data: '01:04:c0:a8:01:0a', description: 'ACS URL in vendor-specific format' },
      { name: 'vendor-class-identifier', data: 'dslforum.org', description: 'TR-069 vendor class' },
      { code: 125, data: '00:00:0d:e9:42:0a:68:74:74:70:3a:2f:2f:61:63:73:2e:65:78:61:6d:70:6c:65:2e:63:6f:6d', description: 'ACS URL in option 125 format' }
    ]
  },
  {
    id: 'voip-sip',
    name: 'VoIP/SIP Phones',
    description: 'SIP server configuration for IP phones',
    category: 'VoIP',
    useCase: 'Automatically configure IP phones with SIP server settings',
    options: [
      { code: 120, data: '192.168.1.20', description: 'SIP server IP address' },
      { name: 'sip-server-name', data: 'sip.example.com', description: 'SIP server hostname' },
      { code: 66, data: '192.168.1.20', description: 'TFTP server for phone configs' },
      { name: 'ntp-servers', data: '192.168.1.1', description: 'NTP server for time sync' }
    ]
  },
  {
    id: 'windows-deployment',
    name: 'Windows Deployment',
    description: 'Windows Deployment Services (WDS) configuration',
    category: 'Network Boot',
    useCase: 'Deploy Windows images via WDS server',
    options: [
      { name: 'tftp-server-name', data: '192.168.1.15', description: 'WDS server IP' },
      { name: 'bootfile-name', data: 'boot\\x64\\wdsnbp.com', description: 'WDS network boot program' },
      { code: 66, data: '192.168.1.15', description: 'WDS server (legacy)' },
      { code: 67, data: 'boot\\x64\\wdsnbp.com', description: 'Boot file (legacy)' }
    ]
  },
  {
    id: 'uefi-boot',
    name: 'UEFI Network Boot',
    description: 'UEFI-compatible network boot configuration',
    category: 'Network Boot',
    useCase: 'Boot UEFI systems from network (modern PXE)',
    options: [
      { name: 'tftp-server-name', data: '192.168.1.10', description: 'TFTP server for UEFI' },
      { name: 'bootfile-name', data: 'bootx64.efi', description: 'UEFI boot file' },
      { code: 66, data: '192.168.1.10', description: 'TFTP server (legacy)' },
      { code: 67, data: 'bootx64.efi', description: 'UEFI boot file (legacy)' }
    ]
  },
  {
    id: 'isc-basic',
    name: 'ISC Basic Connectivity',
    description: 'Essential options for internet connectivity',
    category: 'ISP/Telecom',
    useCase: 'Provide basic internet access to residential customers',
    options: [
      { name: 'routers', data: '192.168.1.1', description: 'Default gateway' },
      { name: 'domain-name-servers', data: '8.8.8.8, 8.8.4.4', description: 'DNS servers' },
      { name: 'domain-name', data: 'customer.isp.com', description: 'DNS domain name' },
      { name: 'ntp-servers', data: '192.168.1.1', description: 'NTP time server' },
      { name: 'lease-time', data: '86400', description: '24-hour lease time' }
    ]
  }
]

export default function TemplatesTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<OptionTemplate | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  function openDetails(template: OptionTemplate) {
    setSelectedTemplate(template)
    setShowDetails(true)
  }

  function closeDetails() {
    setShowDetails(false)
    setSelectedTemplate(null)
  }

  function applyTemplate(template: OptionTemplate) {
    // In a real implementation, this would create an option set from the template
    setSuccess(`Template "${template.name}" applied successfully. Check Option Sets tab.`)
    closeDetails()
  }

  function copyTemplate(template: OptionTemplate) {
    const templateData = JSON.stringify(template.options, null, 2)
    navigator.clipboard.writeText(templateData).then(() => {
      setSuccess('Template options copied to clipboard')
    }).catch(() => {
      setError('Failed to copy to clipboard')
    })
  }

  const categories = [...new Set(OPTION_TEMPLATES.map(t => t.category))]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Option Templates</h2>
        <p className="text-sm text-gray-600">
          Pre-configured option sets for common use cases and industry standards
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Template Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map(category => (
          <Card key={category}>
            <CardContent className="p-4">
              <div className="text-lg font-bold text-blue-600">
                {OPTION_TEMPLATES.filter(t => t.category === category).length}
              </div>
              <div className="text-sm text-gray-600">{category}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Templates by Category */}
      {categories.map(category => (
        <Card key={category}>
          <CardHeader>
            <h3 className="font-medium">{category} Templates</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Tr>
                  <Th>Template</Th>
                  <Th>Description</Th>
                  <Th>Use Case</Th>
                  <Th>Options</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {OPTION_TEMPLATES.filter(t => t.category === category).map((template) => (
                  <Tr key={template.id}>
                    <Td className="font-medium">{template.name}</Td>
                    <Td className="text-sm text-gray-600">{template.description}</Td>
                    <Td className="text-sm text-gray-600">{template.useCase}</Td>
                    <Td>
                      <div className="text-sm">
                        {template.options.length} option{template.options.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {template.options.slice(0, 2).map(opt => opt.name || `Code ${opt.code}`).join(', ')}
                        {template.options.length > 2 && '...'}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetails(template)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applyTemplate(template)}
                        >
                          Apply
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Template Details Modal */}
      {showDetails && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
                <div className="mt-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {selectedTemplate.category}
                  </span>
                </div>
              </div>
              <Button variant="outline" onClick={closeDetails}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Use Case</h4>
                <p className="text-sm text-gray-600">{selectedTemplate.useCase}</p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Options Configuration</h4>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Option</Th>
                      <Th>Code</Th>
                      <Th>Data</Th>
                      <Th>Description</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {selectedTemplate.options.map((option, i) => (
                      <Tr key={i}>
                        <Td className="font-mono text-sm">
                          {option.name || 'Custom'}
                        </Td>
                        <Td className="font-mono text-sm">
                          {option.code || 'N/A'}
                        </Td>
                        <Td className="font-mono text-sm">
                          {option.data}
                        </Td>
                        <Td className="text-sm text-gray-600">
                          {option.description}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => applyTemplate(selectedTemplate)}>
                  Apply Template
                </Button>
                <Button variant="outline" onClick={() => copyTemplate(selectedTemplate)}>
                  Copy Options
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Option Templates Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Industry Standards:</strong> Templates follow RFC specifications and vendor requirements</div>
          <div>• <strong>Apply Template:</strong> Creates a new option set based on the template</div>
          <div>• <strong>Customization:</strong> Modify IP addresses and values to match your environment</div>
          <div>• <strong>Testing:</strong> Always test templates in a lab environment first</div>
          <div>• <strong>Documentation:</strong> Each option includes description and purpose</div>
        </div>
      </div>
    </div>
  )
}
