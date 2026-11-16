import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <Spinner size={size === 'sm' ? 15 : 17} /> : icon}
      {children ? <span className="btn__label">{children}</span> : null}
      {iconRight}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'plain' | 'solid' | 'outline'
  size?: 'sm' | 'md'
}

export function IconButton({
  label,
  variant = 'plain',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={['icon-btn', `icon-btn--${variant}`, `icon-btn--${size}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
