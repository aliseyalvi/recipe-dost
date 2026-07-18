export type LegalLinkType =
  | 'privacy_policy'
  | 'terms'
  | 'account_deletion'
  | 'support'

const configuredLegalUrls: Record<LegalLinkType, string | undefined> = {
  privacy_policy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  terms: process.env.EXPO_PUBLIC_TERMS_URL,
  account_deletion: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  support: process.env.EXPO_PUBLIC_SUPPORT_URL,
}

export function getLegalUrl(type: LegalLinkType) {
  const value = configuredLegalUrls[type]?.trim()
  return isValidPublicHttpsUrl(value) ? value : null
}

export function isValidPublicHttpsUrl(value: string | null | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname.toLowerCase()) &&
      !/example\.(?:com|org|net)$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}
