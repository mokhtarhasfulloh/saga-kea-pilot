import { useState } from 'react'
import { ALL_TEMPLATES, OptionTemplate, applyTemplate, validateTemplateParameters } from '../../lib/dhcpTemplates'
import Button from '../ui/button'
import Input from '../ui/input'
import Select from '../ui/select'
import { Alert } from '../ui/alert'

interface TemplateSelectorProps {
  onApplyTemplate: (options: any[], scope?: { type: 'subnet' | 'class', id: string }) => Promise<void>
  availableSubnets: Array<{ subnet: string; id?: number }>
  availableClasses: Array<{ name: string }>
  busy: boolean
}

export default function TemplateSelector({ 
  onApplyTemplate, 
  availableSubnets, 
  availableClasses, 
  busy 
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<OptionTemplate | null>(null)
  const [parameters, setParameters] = useState<Record<string, any>>({})
  const [scope, setScope] = useState<'global' | 'subnet' | 'class'>('global')
  const [targetSubnet, setTargetSubnet] = useState('')
  const [targetClass, setTargetClass] = useState('')
  const [error, setError] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  const categories = [
    { key: 'tr069', label: 'TR-069/CWMP', color: 'blue' },
    { key: 'pxe', label: 'PXE Boot', color: 'orange' },
    { key: 'vendor', label: 'Vendor Specific', color: 'green' },
    { key: 'network', label: 'Network Services', color: 'purple' },
  ]

  function selectTemplate(template: OptionTemplate) {
    setSelectedTemplate(template)
    setParameters({})
    setError('')
    
    // Set default values
    template.parameters?.forEach(param => {
      if (param.default !== undefined) {
        setParameters(prev => ({ ...prev, [param.key]: param.default }))
      }
    })
  }

  function updateParameter(key: string, value: any) {
    setParameters(prev => ({ ...prev, [key]: value }))
  }

  async function applySelectedTemplate() {
    if (!selectedTemplate) return
    
    setError('')
    const errors = validateTemplateParameters(selectedTemplate, parameters)
    if (errors.length > 0) {
      setError(errors.join(', '))
      return
    }

    try {
      const options = applyTemplate(selectedTemplate, parameters)
      
      const targetScope = scope === 'subnet' && targetSubnet ? 
        { type: 'subnet' as const, id: targetSubnet } :
        scope === 'class' && targetClass ?
        { type: 'class' as const, id: targetClass } :
        undefined

      await onApplyTemplate(options, targetScope)
      setSelectedTemplate(null)
      setParameters({})
    } catch (e: any) {
      setError(String(e))
    }
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Option Templates & Presets</div>
        <Button 
          variant="outline" 
          onClick={() => setShowTemplates(!showTemplates)}
        >
          {showTemplates ? 'Hide Templates' : 'Show Templates'}
        </Button>
      </div>

      {showTemplates && (
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Template Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map(category => {
              const templates = ALL_TEMPLATES.filter(t => t.category === category.key)
              return (
                <div key={category.key} className="space-y-2">
                  <div className={`text-xs font-semibold text-${category.color}-600 border-l-2 border-${category.color}-500 pl-2`}>
                    {category.label}
                  </div>
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template)}
                      className={`w-full text-left p-2 text-xs border rounded hover:bg-gray-50 ${
                        selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      {template.vendor && (
                        <div className="text-gray-500 text-xs">{template.vendor}</div>
                      )}
                      <div className="text-gray-600 text-xs mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Template Configuration */}
          {selectedTemplate && (
            <div className="border-t pt-3 space-y-3">
              <div className="text-sm font-semibold">
                Configure: {selectedTemplate.name}
              </div>

              {/* Scope Selection */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="block text-xs mb-1">Apply To</label>
                  <Select
                    className="text-sm"
                    value={scope}
                    onChange={e => setScope(e.target.value as any)}
                  >
                    <option value="global">Global</option>
                    <option value="subnet">Subnet</option>
                    <option value="class">Client Class</option>
                  </Select>
                </div>
                {scope === 'subnet' && (
                  <div>
                    <label className="block text-xs mb-1">Subnet</label>
                    <Select
                      className="text-sm"
                      value={targetSubnet}
                      onChange={e => setTargetSubnet(e.target.value)}
                    >
                      <option value="">Select subnet...</option>
                      {availableSubnets.map((s, i) => (
                        <option key={i} value={s.subnet}>{s.subnet} (ID: {s.id || i})</option>
                      ))}
                    </Select>
                  </div>
                )}
                {scope === 'class' && (
                  <div>
                    <label className="block text-xs mb-1">Client Class</label>
                    <Select
                      className="text-sm"
                      value={targetClass}
                      onChange={e => setTargetClass(e.target.value)}
                    >
                      <option value="">Select class...</option>
                      {availableClasses.map((c, i) => (
                        <option key={i} value={c.name}>{c.name}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {/* Template Parameters */}
              {selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTemplate.parameters.map(param => (
                    <div key={param.key}>
                      <label className="block text-xs mb-1">
                        {param.label} {param.required && <span className="text-red-500">*</span>}
                      </label>
                      {param.type === 'select' ? (
                        <Select
                          className="text-sm"
                          value={parameters[param.key] || ''}
                          onChange={e => updateParameter(param.key, e.target.value)}
                        >
                          <option value="">Select...</option>
                          {param.options?.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={param.type === 'number' ? 'number' : param.type === 'boolean' ? 'checkbox' : 'text'}
                          placeholder={param.placeholder}
                          value={parameters[param.key] || ''}
                          onChange={e => updateParameter(param.key, 
                            param.type === 'number' ? Number(e.target.value) :
                            param.type === 'boolean' ? e.target.checked :
                            e.target.value
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Apply Button */}
              <div className="flex gap-2 pt-2">
                <Button onClick={applySelectedTemplate} disabled={busy}>
                  Apply Template
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTemplate(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
