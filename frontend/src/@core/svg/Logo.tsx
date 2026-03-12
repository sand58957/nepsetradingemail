// React Imports
import type { SVGAttributes } from 'react'

const Logo = (props: SVGAttributes<SVGElement>) => {
  return (
    <svg width='1em' height='1em' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      {/* Circular ring with gap at bottom-left */}
      <path
        d='M50 5 A45 45 0 1 1 18 82'
        stroke='#00A651'
        strokeWidth='12'
        strokeLinecap='round'
        fill='none'
      />
      <path
        d='M18 82 A45 45 0 0 1 26.5 18'
        stroke='#00A651'
        strokeWidth='12'
        strokeLinecap='round'
        fill='none'
      />
      {/* Upward trending chart arrow */}
      <polyline
        points='20,72 38,55 50,65 72,32'
        stroke='#00A651'
        strokeWidth='10'
        strokeLinecap='round'
        strokeLinejoin='round'
        fill='none'
      />
      {/* Arrow head */}
      <polygon
        points='72,32 72,48 58,38'
        fill='#00A651'
      />
    </svg>
  )
}

export default Logo
