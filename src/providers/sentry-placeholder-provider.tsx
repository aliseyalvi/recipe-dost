import { ReactNode } from 'react'
import {
  captureSentryException,
  initializeSentry,
} from '@/lib/observability/sentry'

initializeSentry()

type Props = {
  children: ReactNode
}

export function SentryPlaceholderProvider({ children }: Props) {
  return <>{children}</>
}

export function captureException(error: unknown) {
  return captureSentryException(error)
}
