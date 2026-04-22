import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'ghost' | 'outline' | 'primary'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({ className, variant = 'ghost', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'font-text inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap font-sans transition-colors disabled:pointer-events-none disabled:opacity-50',
        {
          ghost: 'text-text-secondary hover:bg-state-hover bg-transparent',
          outline:
            'border-border-subtle text-text-secondary hover:bg-state-hover border-[0.5px] bg-transparent',
          primary: 'bg-accent-strong text-white hover:opacity-90',
        }[variant],
        {
          sm: 'h-8 gap-1.5 rounded-sm px-2.5 text-sm',
          md: 'h-8 gap-1.5 rounded-sm px-3 text-sm',
          icon: 'h-8 w-8 rounded-md',
        }[size],
        className,
      )}
      {...props}
    />
  )
}
