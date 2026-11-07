import { useId } from "react"

import styles from "./Logo.module.css"

interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
  alt?: string | undefined
  animated?: boolean | undefined
}

export function Logo({ width = 32, height = 32, alt = "Burneto", animated = false }: LogoProps) {
  const id = useId()

  if (!animated) {
    return <img src="/icon-192.png" alt={alt} width={width} height={height} />
  }

  // oxlint-disable jsx-a11y/prefer-tag-over-role -- 燃焼表現を含むSVG全体を1つの画像として読み上げる。
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 512 512"
      role="img"
      aria-label={alt || undefined}
      aria-hidden={alt === ""}
    >
      <defs>
        <filter
          id={`${id}-burn`}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.008"
            numOctaves="2"
            seed="8"
            stitchTiles="stitch"
            x="0"
            y="0"
            width="512"
            height="256"
            result="noise"
          />
          <feComponentTransfer in="noise" x="0" y="0" width="512" height="256" result="contrast">
            <feFuncR type="linear" slope="2.5" intercept="-0.75" />
            <feFuncG type="linear" slope="2.5" intercept="-0.75" />
            <feFuncA type="linear" slope="0" intercept="1" />
          </feComponentTransfer>
          <feTile in="contrast" x="0" y="-256" width="512" height="1024" result="tiles" />
          <feOffset in="tiles" result="flow">
            <animate attributeName="dy" from="0" to="-256" dur="1.2s" repeatCount="indefinite" />
          </feOffset>
          <feColorMatrix
            in="flow"
            values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0.5"
            result="light"
          />
          <feComposite
            in="SourceGraphic"
            in2="light"
            operator="arithmetic"
            k1="0.8"
            k2="0.6"
            k3="0"
            k4="0"
            result="lit"
          />
          <feComposite in="lit" in2="SourceGraphic" operator="atop" />
        </filter>
      </defs>
      <image
        href="/icon-512.png"
        width="512"
        height="512"
        className={styles.flame}
        filter={`url(#${id}-burn)`}
      />
    </svg>
  )
  // oxlint-enable jsx-a11y/prefer-tag-over-role
}
