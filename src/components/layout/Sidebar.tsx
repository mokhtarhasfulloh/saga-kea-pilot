import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  BarChart3,
  Network,
  Wifi,
  Shield,
  Globe,
  Settings,
  Plug,
  Database,
  Package,
  Zap
} from 'lucide-react'

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

// Simple accordion implementation since we can't import the component
interface AccordionProps {
  type?: 'single' | 'multiple'
  defaultValue?: string
  collapsible?: boolean
  children: React.ReactNode
}

function Accordion({ children }: AccordionProps) {
  return <div className="space-y-1">{children}</div>
}

function AccordionItem({ children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

function AccordionTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

function AccordionContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

interface NavLinkProps {
  to: string
  children: React.ReactNode
  icon?: React.ReactNode
}

function NavLink({ to, children, icon }: NavLinkProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      )}
    >
      {icon && <span className="h-4 w-4">{icon}</span>}
      {children}
    </Link>
  )
}

export default function Sidebar() {
  const location = useLocation()

  // Determine which accordion section should be open based on current route
  const getDefaultValue = () => {
    const path = location.pathname
    if (path === '/' || path === '/statistics') return 'overview'
    if (path.startsWith('/dhcp') || path === '/ha' || path === '/ddns') return 'dhcp'
    if (path.startsWith('/dns')) return 'dns'
    return 'system'
  }

  return (
    <aside className="w-64 shrink-0 border-r bg-background/80 backdrop-blur">
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Kea Pilot</h1>
          <p className="text-xs text-muted-foreground">by Saga</p>
        </div>

        <Accordion type="single" collapsible defaultValue={getDefaultValue()}>
          <AccordionItem value="overview" className="border-none">
            <AccordionTrigger className="py-3 px-0 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4" />
                Overview
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-1 pl-6">
                <NavLink to="/" icon={<Home className="h-4 w-4" />}>
                  Dashboard
                </NavLink>
                <NavLink to="/statistics" icon={<BarChart3 className="h-4 w-4" />}>
                  Statistics
                </NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dhcp" className="border-none">
            <AccordionTrigger className="py-3 px-0 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Network className="h-4 w-4" />
                DHCP Services
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-1 pl-6">
                <NavLink to="/dhcp" icon={<Network className="h-4 w-4" />}>
                  DHCPv4 Manager
                </NavLink>
                <NavLink to="/dhcpv6" icon={<Wifi className="h-4 w-4" />}>
                  DHCPv6 Manager
                </NavLink>
                <NavLink to="/ha" icon={<Shield className="h-4 w-4" />}>
                  High Availability
                </NavLink>
                <NavLink to="/ddns" icon={<Globe className="h-4 w-4" />}>
                  DDNS Manager
                </NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dns" className="border-none">
            <AccordionTrigger className="py-3 px-0 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4" />
                DNS Services
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-1 pl-6">
                <NavLink to="/dns" icon={<Globe className="h-4 w-4" />}>
                  DNS Manager
                </NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="system" className="border-none">
            <AccordionTrigger className="py-3 px-0 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                System
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <div className="space-y-1 pl-6">
                <NavLink to="/hooks" icon={<Plug className="h-4 w-4" />}>
                  Hooks & Extensions
                </NavLink>
                <NavLink to="/config-backend" icon={<Database className="h-4 w-4" />}>
                  Config Backend
                </NavLink>
                <NavLink to="/option-sets" icon={<Package className="h-4 w-4" />}>
                  Option Sets
                </NavLink>
                <NavLink to="/bulk-ops" icon={<Zap className="h-4 w-4" />}>
                  Bulk Operations
                </NavLink>
                <NavLink to="/settings" icon={<Settings className="h-4 w-4" />}>
                  Settings
                </NavLink>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  )
}

