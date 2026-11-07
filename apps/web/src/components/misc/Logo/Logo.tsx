import { useEffect, useRef } from "react"

import { animateFlame } from "./animateFlame"

import styles from "./Logo.module.css"

interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
  alt?: string | undefined
  animated?: boolean | undefined
}

export function Logo({ width = 32, height = 32, alt = "Burneto", animated = false }: LogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!animated || !canvasRef.current) return
    return animateFlame(canvasRef.current)
  }, [animated, width, height])

  if (!animated) {
    return <img src="/icon-192.png" alt={alt} width={width} height={height} />
  }

  // oxlint-disable jsx-a11y/prefer-tag-over-role -- Canvasで動かすロゴを1つの画像として読み上げる。
  return (
    <span className={styles.animated}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt === ""}
      />
      <img
        src="/icon-512.png"
        alt={alt}
        width={width}
        height={height}
        className={styles.fallback}
      />
    </span>
  )
  // oxlint-enable jsx-a11y/prefer-tag-over-role
}
