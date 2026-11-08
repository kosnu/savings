import animatedLogoUrl from "./logoAnimated.webp"

interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
  alt?: string | undefined
  animated?: boolean | undefined
}

export function Logo({ width = 32, height = 32, alt = "Burneto", animated = false }: LogoProps) {
  if (!animated) {
    return <img src="/icon-192.png" alt={alt} width={width} height={height} />
  }

  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet="/icon-192.png" />
      <img src={animatedLogoUrl} alt={alt} width={width} height={height} />
    </picture>
  )
}
