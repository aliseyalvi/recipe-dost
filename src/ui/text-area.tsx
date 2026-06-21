import { Input } from '@/ui/input'
import { TextInputProps } from 'react-native'

type Props = Omit<TextInputProps, 'multiline'> & {
  label: string
}

export function TextArea({ label, ...textInputProps }: Props) {
  return (
    <Input
      label={label}
      multiline
      textAlignVertical="top"
      {...textInputProps}
      style={[
        {
          minHeight: 120,
          paddingTop: 12,
          paddingBottom: 12,
        },
        textInputProps.style,
      ]}
    />
  )
}
