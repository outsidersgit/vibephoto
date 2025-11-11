const KNOWN_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 }
]

const RATIO_TOLERANCE = 0.05

const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b)
}

export function getAspectRatioValue(
  width?: number | null,
  height?: number | null,
  fallback?: string | null
): string | null {
  if (width && height && width > 0 && height > 0) {
    const numericRatio = width / height

    // Try to match a known aspect ratio first
    const closestKnown = KNOWN_RATIOS.reduce((closest, current) => {
      const currentDiff = Math.abs(current.value - numericRatio)
      const closestDiff = Math.abs(closest.value - numericRatio)
      return currentDiff < closestDiff ? current : closest
    })

    if (Math.abs(closestKnown.value - numericRatio) <= RATIO_TOLERANCE) {
      return closestKnown.label
    }

    // Fallback to simplified fraction
    const roundedWidth = Math.round(width)
    const roundedHeight = Math.round(height)
    const divisor = gcd(roundedWidth, roundedHeight) || 1

    const simplifiedWidth = Math.round(roundedWidth / divisor)
    const simplifiedHeight = Math.round(roundedHeight / divisor)

    return `${simplifiedWidth}:${simplifiedHeight}`
  }

  return fallback ?? null
}

export function getAspectRatioLabel(
  width?: number | null,
  height?: number | null,
  fallback?: string | null
): string {
  const value = getAspectRatioValue(width, height, fallback)

  if (value) {
    return value
  }

  return '—'
}

