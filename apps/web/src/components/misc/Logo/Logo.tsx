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
      viewBox="-32 -32 576 576"
      role="img"
      aria-label={alt || undefined}
      aria-hidden={alt === ""}
    >
      <defs>
        <linearGradient id={`${id}-heat`} x1="0" y1="1" x2="0" y2="0">
          <stop stopColor="var(--accent-9)" stopOpacity="0.7" />
          <stop offset="0.55" stopColor="var(--accent-7)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--accent-4)" stopOpacity="0.6" />
        </linearGradient>
        <filter
          id={`${id}-burn`}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
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
          <feDisplacementMap
            in="SourceGraphic"
            in2="flow"
            scale="44"
            xChannelSelector="R"
            yChannelSelector="G"
            result="warped"
          />
          <feColorMatrix
            in="flow"
            values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 0.5"
            result="light"
          />
          <feComposite
            in="warped"
            in2="light"
            operator="arithmetic"
            k1="0.5"
            k2="0.75"
            k3="0"
            k4="0"
          />
        </filter>
      </defs>
      <g className={styles.flame} filter={`url(#${id}-burn)`}>
        <g className={styles.plumes} fill={`url(#${id}-heat)`}>
          <path d="M246 470 C147 452 75 406 92 336 C105 290 150 277 133 228 C188 276 177 322 160 346 C141 378 179 421 246 470 Z">
            <animate
              attributeName="d"
              values="M246 470 C147 452 75 406 92 336 C105 290 150 277 133 228 C188 276 177 322 160 346 C141 378 179 421 246 470 Z;M246 470 C128 457 69 405 83 339 C91 264 153 253 122 195 C206 254 185 316 155 350 C129 399 192 424 246 470 Z;M246 470 C151 450 70 422 96 348 C116 310 140 287 148 248 C197 284 183 329 169 350 C154 390 189 429 246 470 Z;M246 470 C147 452 75 406 92 336 C105 290 150 277 133 228 C188 276 177 322 160 346 C141 378 179 421 246 470 Z"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M267 468 C397 451 459 377 423 317 C400 278 392 252 404 207 C352 241 354 289 373 321 C409 370 350 429 267 468 Z">
            <animate
              attributeName="d"
              values="M267 468 C397 451 459 377 423 317 C400 278 392 252 404 207 C352 241 354 289 373 321 C409 370 350 429 267 468 Z;M267 468 C422 456 478 362 428 299 C404 259 438 210 420 159 C344 226 354 282 376 321 C421 378 345 433 267 468 Z;M267 468 C394 453 461 391 434 334 C407 294 384 275 398 235 C349 262 360 307 380 334 C405 381 344 430 267 468 Z;M267 468 C397 451 459 377 423 317 C400 278 392 252 404 207 C352 241 354 289 373 321 C409 370 350 429 267 468 Z"
              begin="-0.4s"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
          <path d="M225 286 C169 239 195 190 220 158 C255 116 278 72 199 7 C328 53 356 145 303 208 C279 246 252 254 225 286 Z">
            <animate
              attributeName="d"
              values="M225 286 C169 239 195 190 220 158 C255 116 278 72 199 7 C328 53 356 145 303 208 C279 246 252 254 225 286 Z;M225 286 C162 235 186 181 214 147 C252 98 261 55 230 -8 C341 57 350 142 301 205 C277 243 252 257 225 286 Z;M225 286 C175 235 206 186 231 155 C268 112 291 85 181 19 C315 39 371 143 309 213 C282 247 252 254 225 286 Z;M225 286 C169 239 195 190 220 158 C255 116 278 72 199 7 C328 53 356 145 303 208 C279 246 252 254 225 286 Z"
              begin="-0.8s"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
        </g>
        <image href="/icon-512.png" width="512" height="512" />
      </g>
    </svg>
  )
  // oxlint-enable jsx-a11y/prefer-tag-over-role
}
