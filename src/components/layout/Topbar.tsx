import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import ThemeToggle from '../ThemeToggle'

export default function Topbar() {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logout()
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400'
      case 'operator':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-950/20 dark:text-gray-400'
    }
  }

  return (
    <header className="h-12 border-b px-4 flex items-center justify-between">
      <div className="font-medium">SagaOS</div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="font-medium">{user.displayName || user.username}</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                {user.role}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-sm"
            >
              Logout
            </Button>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}

