import { useSyncExternalStore } from 'react'

// Saved choice, applied before React loads by the script in index.html. With no choice saved, the system setting decides.
const STORAGE_KEY = 'iai_theme'
const listeners = new Set()

const systemQuery = () => window.matchMedia?.('(prefers-color-scheme: light)')

export function currentTheme() {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return systemQuery()?.matches ? 'light' : 'dark'
}

function subscribe(listener) {
  listeners.add(listener)
  const query = systemQuery()
  query?.addEventListener?.('change', listener)
  return () => {
    listeners.delete(listener)
    query?.removeEventListener?.('change', listener)
  }
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage unavailable: the theme still applies until the page is reloaded
  }
  listeners.forEach(listener => listener())
}

// 'light' or 'dark', re-rendering when it changes
export const useTheme = () => useSyncExternalStore(subscribe, currentTheme)
