import { ZoneValidationT } from '../lib/schemas/dns'
import { Card } from './ui/card'

interface ValidationOutputProps {
  validation: ZoneValidationT
  title?: string
}

export default function ValidationOutput({ validation, title = 'Validation Results' }: ValidationOutputProps) {
  const hasErrors = validation.errors.length > 0
  const hasWarnings = validation.warnings.length > 0

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="font-medium">{title}</h4>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          validation.valid 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {validation.valid ? 'Valid' : 'Invalid'}
        </div>
      </div>

      {hasErrors && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-red-700 mb-2">Errors:</h5>
          <ul className="space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-yellow-700 mb-2">Warnings:</h5>
          <ul className="space-y-1">
            {validation.warnings.map((warning, index) => (
              <li key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {validation.output && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Raw Output:</h5>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto whitespace-pre-wrap">
            {validation.output}
          </pre>
        </div>
      )}

      {!hasErrors && !hasWarnings && validation.valid && (
        <div className="text-sm text-green-600">
          Zone configuration is valid with no issues detected.
        </div>
      )}
    </Card>
  )
}
