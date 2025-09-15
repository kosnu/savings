interface LogoProps {
  width?: string | number | undefined
  height?: string | number | undefined
}

export function Logo({ width = 22, height = 22 }: LogoProps) {
  return <img src="/icon.svg" alt="Logo" width={width} height={height} />
}
