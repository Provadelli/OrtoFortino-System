import { useSyncExternalStore } from 'react'
import { tokenStore } from './token-store'

export function useSession() {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, () => null)
}
