import type { ElementType, ReactNode } from 'react'

import {
  PAGE_CONTAINER_CLASS,
  PAGE_CONTAINER_FLUID_CLASS,
  PAGE_CONTAINER_WIDE_CLASS,
  PAGE_MAIN_CLASS,
  PAGE_SECTION_STACK_CLASS,
} from '@/lib/layout/container-classes'
import { cn } from '@/lib/utils'

type ContainerWidth = 'default' | 'wide' | 'fluid'

const WIDTH_CLASS: Record<ContainerWidth, string> = {
  default: PAGE_CONTAINER_CLASS,
  wide: PAGE_CONTAINER_WIDE_CLASS,
  fluid: PAGE_CONTAINER_FLUID_CLASS,
}

interface PageContainerProps {
  children: ReactNode
  className?: string
  as?: ElementType
  width?: ContainerWidth
}

export function PageContainer({
  children,
  className,
  as: Tag = 'div',
  width = 'default',
}: PageContainerProps) {
  return <Tag className={cn(WIDTH_CLASS[width], className)}>{children}</Tag>
}

interface PageMainProps {
  children: ReactNode
  className?: string
  as?: ElementType
}

export function PageMain({ children, className, as: Tag = 'main' }: PageMainProps) {
  return <Tag className={cn(PAGE_MAIN_CLASS, className)}>{children}</Tag>
}

interface PageSectionStackProps {
  children: ReactNode
  className?: string
  as?: ElementType
}

export function PageSectionStack({
  children,
  className,
  as: Tag = 'div',
}: PageSectionStackProps) {
  return <Tag className={cn(PAGE_SECTION_STACK_CLASS, className)}>{children}</Tag>
}
