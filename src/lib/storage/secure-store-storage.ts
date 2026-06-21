import * as SecureStore from 'expo-secure-store'

const fallbackStorage = new Map<string, string>()

export const secureStoreStorage = {
  async getItem(key: string) {
    try {
      return (await SecureStore.getItemAsync(key)) ?? fallbackStorage.get(key) ?? null
    } catch {
      return fallbackStorage.get(key) ?? null
    }
  },
  async setItem(key: string, value: string) {
    fallbackStorage.set(key, value)

    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Keep non-native development surfaces usable.
    }
  },
  async removeItem(key: string) {
    fallbackStorage.delete(key)

    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // Nothing else to remove when SecureStore is unavailable.
    }
  },
}
