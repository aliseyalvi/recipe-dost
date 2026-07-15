import { borders, colors, radius, spacing, typography } from '@/theme'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon, type AppIconName } from '@/ui/app-icon'

type MenuAction = {
  icon: AppIconName
  label: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

export function RecipeDetailActionMenu({
  visible,
  title,
  subtitle,
  isFavorite,
  isFavoriteUpdating,
  isDeleting,
  canOpenOriginal,
  canViewSource,
  errorMessage,
  onClose,
  onOpenOriginal,
  onViewSource,
  onToggleFavorite,
  onDelete,
}: {
  visible: boolean
  title: string
  subtitle?: string | null
  isFavorite: boolean
  isFavoriteUpdating: boolean
  isDeleting: boolean
  canOpenOriginal: boolean
  canViewSource: boolean
  errorMessage?: string | null
  onClose: () => void
  onOpenOriginal: () => void
  onViewSource: () => void
  onToggleFavorite: () => void
  onDelete: () => void
}) {
  const insets = useSafeAreaInsets()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const close = () => {
    if (isDeleting) {
      return
    }

    setIsConfirmingDelete(false)
    onClose()
  }

  const actions: MenuAction[] = [
    ...(canOpenOriginal
      ? [
          {
            icon: 'external' as const,
            label: 'Open Original Video',
            onPress: () => {
              onClose()
              onOpenOriginal()
            },
          },
        ]
      : []),
    ...(canViewSource
      ? [
          {
            icon: 'recipe' as const,
            label: 'View Saved Source',
            onPress: () => {
              onClose()
              onViewSource()
            },
          },
        ]
      : []),
    {
      icon: (isFavorite ? 'heart' : 'heart-outline') as AppIconName,
      label: isFavorite ? 'Unfavorite' : 'Favorite',
      disabled: isFavoriteUpdating,
      onPress: onToggleFavorite,
    },
    {
      icon: 'trash' as const,
      label: 'Delete',
      destructive: true,
      onPress: () => setIsConfirmingDelete(true),
    },
  ]

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={close}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close recipe options"
        onPress={close}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
        }}
      >
        <Pressable
          accessibilityRole="none"
          onPress={(event) => event.stopPropagation()}
          style={{
            gap: spacing.lg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.primaryOutlineSoft,
            backgroundColor: colors.surfaceContainerLow,
            paddingHorizontal: spacing.card,
            paddingTop: spacing.card,
            paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              alignSelf: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.outlineVariant,
              opacity: 0.72,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
              <Text selectable style={[typography.heading, { color: colors.onSurface }]}>
                Recipe options
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={[typography.caption, { color: colors.onSurfaceVariant }]}
              >
                {title}{subtitle ? ` · ${subtitle}` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close recipe options"
              onPress={close}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                backgroundColor: colors.glassElevated,
                opacity: pressed ? 0.68 : 1,
              })}
            >
              <AppIcon name="close" color={colors.onSurface} size={24} />
            </Pressable>
          </View>

          {errorMessage ? (
            <View
              style={{
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: colors.dangerSurface,
                padding: spacing.md,
              }}
            >
              <Text selectable style={[typography.caption, { color: colors.error }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {isConfirmingDelete ? (
            <View style={{ gap: spacing.lg }}>
              <View style={{ gap: spacing.sm }}>
                <Text selectable style={[typography.body, { color: colors.onSurface, fontWeight: '800' }]}>
                  Delete this saved recipe?
                </Text>
                <Text selectable style={[typography.body, { color: colors.onSurfaceVariant }]}>
                  This removes it from your library. It does not affect the original video.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <MenuButton
                  label="Keep recipe"
                  disabled={isDeleting}
                  onPress={() => setIsConfirmingDelete(false)}
                />
                <MenuButton
                  destructive
                  icon="trash"
                  label={isDeleting ? 'Deleting…' : 'Delete'}
                  disabled={isDeleting}
                  onPress={onDelete}
                />
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {actions.map((action) => (
                <MenuRow key={action.label} {...action} />
              ))}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function MenuRow({
  icon,
  label,
  destructive = false,
  disabled = false,
  onPress,
}: MenuAction) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: destructive
          ? 'rgba(255, 180, 171, 0.30)'
          : 'rgba(255, 255, 255, 0.10)',
        backgroundColor: destructive
          ? colors.dangerSurface
          : pressed
            ? colors.surfaceContainerHigh
            : colors.glassElevated,
        paddingHorizontal: spacing.lg,
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: destructive ? colors.errorContainer : colors.primaryWash,
        }}
      >
        <AppIcon
          name={icon}
          color={destructive ? colors.error : colors.primary}
          size={19}
        />
      </View>
      <Text
        selectable={false}
        style={[
          typography.body,
          { color: destructive ? colors.error : colors.onSurface, fontWeight: '700' },
        ]}
      >
        {disabled ? `${label}…` : label}
      </Text>
    </Pressable>
  )
}

function MenuButton({
  label,
  icon,
  destructive = false,
  disabled = false,
  onPress,
}: {
  label: string
  icon?: AppIconName
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.pill,
        ...(destructive ? {} : borders.subtle),
        backgroundColor: destructive ? colors.errorContainer : colors.glassElevated,
        opacity: pressed || disabled ? 0.62 : 1,
      })}
    >
      {icon ? <AppIcon name={icon} color={colors.error} size={18} /> : null}
      <Text
        selectable={false}
        style={[
          typography.caption,
          { color: destructive ? colors.error : colors.onSurface, fontWeight: '800' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}
