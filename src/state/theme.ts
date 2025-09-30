import { atom } from 'jotai'

type Theme = 'light' | 'dark' | 'system'

const getInitialTheme = (): Theme => {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
  if (saved === 'dark' || saved === 'light' || saved === 'system') return saved as Theme
  return 'system' // Default to system preference
}

export const themeAtom = atom<Theme>(getInitialTheme())

