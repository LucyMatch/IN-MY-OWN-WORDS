import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

type AvatarProps = ComponentProps<'div'> & {
  name: string
}

export function Avatar({ className, name, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'bg-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white',
        className,
      )}
      {...props}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
