import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  optional?: boolean
  counter?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, optional = false, counter, children }: FieldProps) {
  return (
    <div className={['field', error ? 'field--error' : ''].filter(Boolean).join(' ')}>
      <div className="field__head">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {optional ? <span className="field__optional">Optional</span> : null}
        {counter ? <span className="field__counter">{counter}</span> : null}
      </div>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint">{hint}</p>
      ) : null}
    </div>
  )
}
