import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import StatusChip from './ui/StatusChip'

export interface HealthStatus {
  service: string
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  message?: string
  lastCheck?: string
  version?: string
  uptime?: string
  details?: Record<string, any>
}

interface HealthTileProps {
  health: HealthStatus
  onClick?: () => void
}

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

export default function HealthTile({ health, onClick }: HealthTileProps) {

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        onClick && 'cursor-pointer hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{health.service}</CardTitle>
          <StatusChip status={health.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {health.message && (
          <p className="text-sm text-muted-foreground">{health.message}</p>
        )}

        <div className="space-y-1 text-xs text-muted-foreground">
          {health.version && (
            <div>Version: {health.version}</div>
          )}
          {health.uptime && (
            <div>Uptime: {health.uptime}</div>
          )}
          {health.lastCheck && (
            <div>Last Check: {new Date(health.lastCheck).toLocaleString()}</div>
          )}
        </div>

        {health.details && Object.keys(health.details).length > 0 && (
          <div className="pt-3 border-t">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(health.details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
