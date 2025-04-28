import type { ComponentProps } from "react"
import styles from "./Paper.module.css"

interface PaperProps extends ComponentProps<"div"> {
  children: React.ReactNode
}

export function Paper({ children, ...props }: PaperProps) {
  const className = [styles.paperRoot, props.className].join(" ")

  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}
