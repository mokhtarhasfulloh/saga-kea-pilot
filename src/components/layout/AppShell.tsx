import Sidebar from './Sidebar'
import AppHeader from './AppHeader'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 max-w-screen-2xl mx-auto">{children}</main>
      </div>
    </div>
  )
}

