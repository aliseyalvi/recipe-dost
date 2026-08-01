import { REVENUECAT_ANDROID_API_KEY } from '@/config/revenuecat'
import { RevenueCatIdentitySynchronizer } from '@/lib/revenuecat/revenuecat-identity'
import type { CustomerInfo } from '@revenuecat/purchases-typescript-internal'
import Purchases from 'react-native-purchases'
import { Platform } from 'react-native'

const identitySynchronizer = new RevenueCatIdentitySynchronizer<CustomerInfo>({
  configure: (appUserId) => {
    Purchases.configure({
      apiKey: REVENUECAT_ANDROID_API_KEY ?? '',
      appUserID: appUserId,
    })
  },
  logIn: (appUserId) => Purchases.logIn(appUserId),
  getCustomerInfo: () => Purchases.getCustomerInfo(),
  logOut: () => Purchases.logOut(),
})

export function canSynchronizeRevenueCatIdentity() {
  return Platform.OS === 'android' && Boolean(REVENUECAT_ANDROID_API_KEY)
}

export function synchronizeRevenueCatIdentity(appUserId: string) {
  if (!canSynchronizeRevenueCatIdentity()) {
    return Promise.resolve(null)
  }

  return identitySynchronizer.synchronize(appUserId)
}

export async function resetRevenueCatIdentity() {
  if (!canSynchronizeRevenueCatIdentity()) {
    return
  }

  await identitySynchronizer.reset()
}

export function getConfiguredRevenueCatUserId() {
  return identitySynchronizer.currentUserId
}
