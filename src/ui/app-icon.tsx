import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps } from 'react'
import type { ColorValue } from 'react-native'

export type AppIconName =
  | 'home-outline'
  | 'home'
  | 'library-outline'
  | 'library'
  | 'add'
  | 'grocery-outline'
  | 'grocery'
  | 'settings-outline'
  | 'settings'
  | 'heart-outline'
  | 'heart'
  | 'share'
  | 'copy'
  | 'more-vertical'
  | 'back'
  | 'forward'
  | 'external'
  | 'creator'
  | 'clock'
  | 'ai-recipe'
  | 'grocery-list'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'link'
  | 'search'
  | 'close'
  | 'trash'
  | 'refresh'
  | 'restore'
  | 'warning'
  | 'hourglass'
  | 'recipe'
  | 'list'
  | 'calendar'
  | 'check'
  | 'play'
  | 'profile'
  | 'language'
  | 'theme'
  | 'privacy'
  | 'support'
  | 'info'
  | 'developer'
  | 'usage'
  | 'download'
  | 'flame'
  | 'servings'
  | 'eye'
  | 'eye-off'

type IoniconName = ComponentProps<typeof Ionicons>['name']

const appIconMap = {
  'home-outline': 'home-outline',
  home: 'home',
  'library-outline': 'library-outline',
  library: 'library',
  add: 'add',
  'grocery-outline': 'cart-outline',
  grocery: 'cart',
  'settings-outline': 'settings-outline',
  settings: 'settings',
  'heart-outline': 'heart-outline',
  heart: 'heart',
  share: 'share-social-outline',
  copy: 'copy-outline',
  'more-vertical': 'ellipsis-vertical',
  back: 'chevron-back',
  forward: 'chevron-forward',
  external: 'open-outline',
  creator: 'person-outline',
  clock: 'time-outline',
  'ai-recipe': 'sparkles',
  'grocery-list': 'list-outline',
  instagram: 'logo-instagram',
  youtube: 'logo-youtube',
  tiktok: 'logo-tiktok',
  facebook: 'logo-facebook',
  link: 'link-outline',
  search: 'search',
  close: 'close',
  trash: 'trash-outline',
  refresh: 'refresh',
  restore: 'refresh-outline',
  warning: 'warning-outline',
  hourglass: 'hourglass-outline',
  recipe: 'book-outline',
  list: 'list',
  calendar: 'calendar-outline',
  check: 'checkmark',
  play: 'play',
  profile: 'person-outline',
  language: 'language-outline',
  theme: 'moon-outline',
  privacy: 'shield-checkmark-outline',
  support: 'help-circle-outline',
  info: 'information-circle-outline',
  developer: 'construct-outline',
  usage: 'flash',
  download: 'download-outline',
  flame: 'flame-outline',
  servings: 'people-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
} satisfies Record<AppIconName, IoniconName>

export function AppIcon({
  name,
  color,
  size = 20,
}: {
  name: AppIconName
  color: ColorValue
  size?: number
}) {
  return (
    <Ionicons
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      name={appIconMap[name]}
      size={size}
      color={color}
    />
  )
}

export function PlatformIcon({
  platform,
  color,
  size = 16,
}: {
  platform: string | null | undefined
  color: ColorValue
  size?: number
}) {
  return (
    <AppIcon
      name={getPlatformIconName(platform)}
      color={color}
      size={size}
    />
  )
}

export function getPlatformIconName(
  platform: string | null | undefined
): AppIconName {
  switch (normalizePlatform(platform)) {
    case 'instagram':
      return 'instagram'
    case 'youtube':
      return 'youtube'
    case 'tiktok':
      return 'tiktok'
    case 'facebook':
      return 'facebook'
    default:
      return 'link'
  }
}

export function normalizePlatform(platform: string | null | undefined) {
  const value = platform?.trim().toLocaleLowerCase().replace(/[\s-]+/g, '_')

  if (value?.includes('instagram')) {
    return 'instagram' as const
  }

  if (value?.includes('youtube')) {
    return 'youtube' as const
  }

  if (value?.includes('tiktok') || value?.includes('tik_tok')) {
    return 'tiktok' as const
  }

  if (value?.includes('facebook')) {
    return 'facebook' as const
  }

  return 'unknown' as const
}
