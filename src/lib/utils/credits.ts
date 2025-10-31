/**
 * Helper function to calculate available credits
 * Formula: credits_available = (credits_limit - credits_used) + credits_balance
 * 
 * This works for:
 * - Regular users (with subscription credits + purchased credits)
 * - Influencer users (only creditsBalance, no subscription)
 */
export function calculateAvailableCredits(
  creditsLimit: number | null | undefined,
  creditsUsed: number | null | undefined,
  creditsBalance: number | null | undefined
): number {
  const limit = creditsLimit ?? 0
  const used = creditsUsed ?? 0
  const balance = creditsBalance ?? 0
  return Math.max(0, (limit - used) + balance)
}

