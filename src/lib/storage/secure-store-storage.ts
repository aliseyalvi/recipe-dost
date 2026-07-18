import * as SecureStore from 'expo-secure-store'

const fallbackStorage = new Map<string, string>()

export type SecureStoreReadResult =
  | { ok: true; value: string | null }
  | { ok: false; error: Error }

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

export async function readSecureStoreItem(
  key: string
): Promise<SecureStoreReadResult> {
  if (!(await isSecureStoreAvailable())) {
    return { ok: true, value: fallbackStorage.get(key) ?? null }
  }

  try {
    return {
      ok: true,
      value: (await SecureStore.getItemAsync(key)) ?? fallbackStorage.get(key) ?? null,
    }
  } catch (caughtError) {
    return {
      ok: false,
      error:
        caughtError instanceof Error
          ? caughtError
          : new Error('Secure storage could not be read.'),
    }
  }
}

export async function writeSecureStoreItem(key: string, value: string) {
  fallbackStorage.set(key, value)

  if (!(await isSecureStoreAvailable())) {
    return
  }

  await SecureStore.setItemAsync(key, value)
}

export async function deleteSecureStoreItem(key: string) {
  fallbackStorage.delete(key)

  if (!(await isSecureStoreAvailable())) {
    return
  }

  await SecureStore.deleteItemAsync(key)
}

export const secureStoreStorage = {
  async getItem(key: string) {
    const result = await readSecureStoreItem(key)
    return result.ok ? result.value : fallbackStorage.get(key) ?? null
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
