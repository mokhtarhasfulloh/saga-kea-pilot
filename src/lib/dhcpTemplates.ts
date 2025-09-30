// DHCP Option Templates and Presets for Kea Pilot
// Provides reusable configurations for common vendor equipment and use cases

export interface OptionTemplate {
  id: string
  name: string
  description: string
  vendor?: string
  category: 'tr069' | 'pxe' | 'vendor' | 'network' | 'custom'
  options: Array<{
    name?: string
    code?: number
    data: string | ((params: Record<string, any>) => string)
    'always-send'?: boolean
    scope?: 'global' | 'subnet' | 'class'
  }>
  parameters?: Array<{
    key: string
    label: string
    type: 'string' | 'number' | 'boolean' | 'select'
    required: boolean
    placeholder?: string
    options?: string[]
    default?: any
  }>
}

// TR-069/CWMP Templates
export const TR069_TEMPLATES: OptionTemplate[] = [
  {
    id: 'tr069-basic',
    name: 'TR-069 Basic ACS',
    description: 'Basic TR-069 configuration with ACS URL only',
    vendor: 'Generic TR-069',
    category: 'tr069',
    options: [
      {
        code: 43,
        data: (params) => encodeTR069Option43({ acsUrl: params.acsUrl }),
        'always-send': true,
      }
    ],
    parameters: [
      {
        key: 'acsUrl',
        label: 'ACS URL',
        type: 'string',
        required: true,
        placeholder: 'https://acs.example.com:7547/acs'
      }
    ]
  },
  {
    id: 'tr069-full',
    name: 'TR-069 Full Configuration',
    description: 'Complete TR-069 setup with credentials and provisioning',
    vendor: 'Generic TR-069',
    category: 'tr069',
    options: [
      {
        code: 43,
        data: (params) => encodeTR069Option43({
          acsUrl: params.acsUrl,
          provisioningCode: params.provisioningCode,
          username: params.username,
          password: params.password,
          periodicInformInterval: params.periodicInformInterval
        }),
        'always-send': true,
      }
    ],
    parameters: [
      {
        key: 'acsUrl',
        label: 'ACS URL',
        type: 'string',
        required: true,
        placeholder: 'https://acs.example.com:7547/acs'
      },
      {
        key: 'provisioningCode',
        label: 'Provisioning Code',
        type: 'string',
        required: false,
        placeholder: 'PROV123'
      },
      {
        key: 'username',
        label: 'CPE Username',
        type: 'string',
        required: false,
        placeholder: 'cpe_user'
      },
      {
        key: 'password',
        label: 'CPE Password',
        type: 'string',
        required: false,
        placeholder: 'cpe_password'
      },
      {
        key: 'periodicInformInterval',
        label: 'Periodic Inform Interval (seconds)',
        type: 'number',
        required: false,
        default: 3600
      }
    ]
  }
]

// PXE Boot Templates
export const PXE_TEMPLATES: OptionTemplate[] = [
  {
    id: 'pxe-basic',
    name: 'PXE Boot Basic',
    description: 'Basic PXE boot with TFTP server and boot file',
    category: 'pxe',
    options: [
      {
        name: 'tftp-server-name',
        data: (params) => params.tftpServer,
      },
      {
        name: 'boot-file-name',
        data: (params) => params.bootFile,
      }
    ],
    parameters: [
      {
        key: 'tftpServer',
        label: 'TFTP Server IP',
        type: 'string',
        required: true,
        placeholder: '10.0.0.5'
      },
      {
        key: 'bootFile',
        label: 'Boot File Name',
        type: 'string',
        required: true,
        placeholder: 'pxelinux.0'
      }
    ]
  },
  {
    id: 'pxe-uefi',
    name: 'PXE Boot UEFI',
    description: 'PXE boot configuration for UEFI systems',
    category: 'pxe',
    options: [
      {
        name: 'tftp-server-name',
        data: (params) => params.tftpServer,
      },
      {
        name: 'boot-file-name',
        data: (params) => params.bootFile,
      },
      {
        code: 60,
        data: 'PXEClient',
      }
    ],
    parameters: [
      {
        key: 'tftpServer',
        label: 'TFTP Server IP',
        type: 'string',
        required: true,
        placeholder: '10.0.0.5'
      },
      {
        key: 'bootFile',
        label: 'UEFI Boot File',
        type: 'string',
        required: true,
        placeholder: 'bootx64.efi'
      }
    ]
  }
]

// Vendor-Specific Templates
export const VENDOR_TEMPLATES: OptionTemplate[] = [
  {
    id: 'unifi-controller',
    name: 'Ubiquiti UniFi Controller',
    description: 'UniFi device provisioning with controller inform URL',
    vendor: 'Ubiquiti',
    category: 'vendor',
    options: [
      {
        code: 43,
        data: (params) => encodeUnifiOption43(params.informUrl),
        'always-send': true,
      }
    ],
    parameters: [
      {
        key: 'informUrl',
        label: 'Controller Inform URL',
        type: 'string',
        required: true,
        placeholder: 'http://unifi.example.com:8080/inform'
      }
    ]
  },
  {
    id: 'mikrotik-capsman',
    name: 'MikroTik CAPsMAN',
    description: 'MikroTik wireless device provisioning',
    vendor: 'MikroTik',
    category: 'vendor',
    options: [
      {
        code: 138,
        data: (params) => params.capsmanAddress,
      }
    ],
    parameters: [
      {
        key: 'capsmanAddress',
        label: 'CAPsMAN Address',
        type: 'string',
        required: true,
        placeholder: '10.0.0.1'
      }
    ]
  }
]

// Network Service Templates
export const NETWORK_TEMPLATES: OptionTemplate[] = [
  {
    id: 'ntp-servers',
    name: 'NTP Time Servers',
    description: 'Network Time Protocol server configuration',
    category: 'network',
    options: [
      {
        name: 'ntp-servers',
        data: (params) => params.ntpServers,
      }
    ],
    parameters: [
      {
        key: 'ntpServers',
        label: 'NTP Server IPs (comma-separated)',
        type: 'string',
        required: true,
        placeholder: '10.0.0.1,10.0.0.2'
      }
    ]
  },
  {
    id: 'dns-servers',
    name: 'DNS Servers',
    description: 'Domain Name System server configuration',
    category: 'network',
    options: [
      {
        name: 'domain-name-servers',
        data: (params) => params.dnsServers,
      },
      {
        name: 'domain-search',
        data: (params) => params.domainSearch || '',
      }
    ],
    parameters: [
      {
        key: 'dnsServers',
        label: 'DNS Server IPs (comma-separated)',
        type: 'string',
        required: true,
        placeholder: '8.8.8.8,8.8.4.4'
      },
      {
        key: 'domainSearch',
        label: 'Domain Search List',
        type: 'string',
        required: false,
        placeholder: 'example.com,local'
      }
    ]
  }
]

// All templates combined
export const ALL_TEMPLATES = [
  ...TR069_TEMPLATES,
  ...PXE_TEMPLATES,
  ...VENDOR_TEMPLATES,
  ...NETWORK_TEMPLATES
]

// Helper functions (imported from OptionsTab)
function encodeTR069Option43(params: {
  acsUrl?: string
  provisioningCode?: string
  username?: string
  password?: string
  periodicInformInterval?: number
}): string {
  const suboptions: string[] = []
  
  if (params.acsUrl) {
    const len = params.acsUrl.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.acsUrl, 'utf8').toString('hex')
    suboptions.push(`01${len}${hex}`)
  }
  
  if (params.provisioningCode) {
    const len = params.provisioningCode.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.provisioningCode, 'utf8').toString('hex')
    suboptions.push(`02${len}${hex}`)
  }
  
  if (params.username) {
    const len = params.username.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.username, 'utf8').toString('hex')
    suboptions.push(`03${len}${hex}`)
  }
  
  if (params.password) {
    const len = params.password.length.toString(16).padStart(2, '0')
    const hex = Buffer.from(params.password, 'utf8').toString('hex')
    suboptions.push(`04${len}${hex}`)
  }
  
  if (params.periodicInformInterval) {
    const value = params.periodicInformInterval.toString(16).padStart(8, '0')
    suboptions.push(`0504${value}`)
  }
  
  return suboptions.join('')
}

function encodeUnifiOption43(informUrl: string): string {
  const hex = Buffer.from(informUrl, 'utf8').toString('hex')
  return hex
}

// Template application helper
export function applyTemplate(template: OptionTemplate, parameters: Record<string, any>) {
  return template.options.map(option => ({
    ...option,
    data: typeof option.data === 'function' ? option.data(parameters) : option.data
  }))
}

// Template validation
export function validateTemplateParameters(template: OptionTemplate, parameters: Record<string, any>): string[] {
  const errors: string[] = []
  
  template.parameters?.forEach(param => {
    if (param.required && !parameters[param.key]) {
      errors.push(`${param.label} is required`)
    }
    
    if (param.type === 'number' && parameters[param.key] && isNaN(Number(parameters[param.key]))) {
      errors.push(`${param.label} must be a number`)
    }
  })
  
  return errors
}
