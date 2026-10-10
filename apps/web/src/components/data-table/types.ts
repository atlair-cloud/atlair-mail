export interface TableColumn {
  key: string
  label: string
  width?: string
  align?: 'left' | 'right'
  hideBelow?: 'sm' | 'md' | 'lg'
  labelHiddenOnMobile?: boolean
}

export interface FilterOption<Value extends string = string> {
  value: Value
  label: string
  dot?: string
}
