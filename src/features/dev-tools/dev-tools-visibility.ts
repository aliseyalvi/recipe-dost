import Constants from 'expo-constants'

export function shouldShowCustomDevTools() {
  return __DEV__ && getAppEnv() === 'development'
}

function getAppEnv() {
  const appEnv = getExpoExtraString('appEnv')

  return appEnv === 'production' ? 'production' : 'development'
}

function getExpoExtraString(key: string) {
  const extra = Constants.expoConfig?.extra

  if (!extra || typeof extra !== 'object') {
    return null
  }

  const value = (extra as Record<string, unknown>)[key]

  return typeof value === 'string' ? value : null
}
