interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
  alt?: string | undefined
}

export function Logo({ width = 32, height = 32, alt = "Burneto" }: LogoProps) {
  return <img src="/icon-192.png" alt={alt} width={width} height={height} />
}
