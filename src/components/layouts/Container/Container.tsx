import type { ComponentPropsWithoutRef } from "react"
import styles from "./Container.module.css"

export type ContainerSize = "small" | "medium" | "large" | "xlarge"

interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  children?: React.ReactNode
  size?: ContainerSize
}

export function Container({ children, size, ...props }: ContainerProps) {
  const className = `${styles.containerRoot} ${styles.containerSize} ${props.className}`

  return (
    <>
      <div {...props} className={className} data-size={size}>
        {children}
      </div>
    </>
  )
}
