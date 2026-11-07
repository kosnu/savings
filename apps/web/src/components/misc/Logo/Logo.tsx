import { useEffect, useId, useRef } from "react"

import { animateFlame } from "./animateFlame"
import artworkUrl from "./logoArtwork.svg"

import styles from "./Logo.module.css"

interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
  alt?: string | undefined
  animated?: boolean | undefined
}

export function Logo({ width = 32, height = 32, alt = "Burneto", animated = false }: LogoProps) {
  const artworkRef = useRef<SVGSVGElement>(null)
  const id = useId()

  useEffect(() => {
    if (!animated || !artworkRef.current) return
    return animateFlame(artworkRef.current, id)
  }, [animated, width, height, id])

  if (!animated) {
    return <img src="/icon-192.png" alt={alt} width={width} height={height} />
  }

  // oxlint-disable jsx-a11y/prefer-tag-over-role -- 輪郭を動かすSVGのロゴを1つの画像として読み上げる。
  return (
    <span className={styles.animated}>
      <svg
        ref={artworkRef}
        className={styles.artwork}
        viewBox="0 0 512 512"
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt === ""}
      />
      <img src={artworkUrl} alt={alt} width={width} height={height} className={styles.fallback} />
    </span>
  )
  // oxlint-enable jsx-a11y/prefer-tag-over-role
}
