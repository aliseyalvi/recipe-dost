import { AppBadge } from '@/ui/app-badge'

type Props = {
  status: string | null
}

export function MetadataStatusBadge({ status }: Props) {
  const label = status ? status.replaceAll('_', ' ') : 'not checked'
  const isFailed = status === 'failed'

  return <AppBadge label={titleCase(label)} tone={isFailed ? 'warning' : 'default'} />
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
