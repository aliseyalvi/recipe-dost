import '@/i18n'

import { AppQueryProvider } from '@/providers/query-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { PostHogPlaceholderProvider } from '@/providers/posthog-placeholder-provider'
import { SentryPlaceholderProvider } from '@/providers/sentry-placeholder-provider'
import { SaveRecipeModalProvider } from '@/features/save-recipe/save-recipe-modal'
import { IncomingRecipeShareIntentHandler } from '@/features/share-intent/use-incoming-recipe-share-intent'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { i18n } from '@/i18n'

type Props = {
  children: ReactNode
}

export function AppProviders({ children }: Props) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SentryPlaceholderProvider>
        <PostHogPlaceholderProvider>
          <I18nextProvider i18n={i18n}>
            <AppQueryProvider>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <SaveRecipeModalProvider>
                    <IncomingRecipeShareIntentHandler />
                    {children}
                  </SaveRecipeModalProvider>
                </BottomSheetModalProvider>
              </AuthProvider>
            </AppQueryProvider>
          </I18nextProvider>
        </PostHogPlaceholderProvider>
      </SentryPlaceholderProvider>
    </GestureHandlerRootView>
  )
}
