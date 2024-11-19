import type { ComponentProps } from "react"
import styles from "./ButtonBase.module.css"

type ButtonProps = ComponentProps<"button">

export interface ButtonBaseProps extends ButtonProps {
  children: React.ReactNode
  size?: "small" | "medium" | "large"
}

export function ButtonBase({
  className,
  type = "button",
  children,
  size = "medium",
  ...props
}: ButtonBaseProps) {
  return (
    <button
      {...props}
      type={type}
      className={[styles.buttonRoot, styles.buttonSize, className].join(" ")}
      data-size={size}
    >
      {children}
    </button>
  )
}
