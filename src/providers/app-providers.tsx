import '@/i18n'

import { AppQueryProvider } from '@/providers/query-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { PostHogPlaceholderProvider } from '@/providers/posthog-placeholder-provider'
import { SentryPlaceholderProvider } from '@/providers/sentry-placeholder-provider'
import { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'

type Props = {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <SentryPlaceholderProvider>
      <PostHogPlaceholderProvider>
        <I18nextProvider i18n={i18n}>
          <AppQueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </AppQueryProvider>
        </I18nextProvider>
      </PostHogPlaceholderProvider>
    </SentryPlaceholderProvider>
  )
}
