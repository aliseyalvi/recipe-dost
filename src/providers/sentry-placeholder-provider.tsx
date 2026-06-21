import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export function SentryPlaceholderProvider({ children }: Props) {
  return <>{children}</>
}

export function captureException(_error: unknown) {
  return undefined
}
