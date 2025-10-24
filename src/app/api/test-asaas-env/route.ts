import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.ASAAS_API_KEY
  const environment = process.env.ASAAS_ENVIRONMENT

  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPreview: apiKey ? `${apiKey.substring(0, 30)}...` : 'MISSING',
    apiKeyLast20: apiKey ? `...${apiKey.substring(apiKey.length - 20)}` : 'MISSING',
    environment,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('ASAAS')),
    hasSpaces: apiKey?.includes(' '),
    hasNewlines: apiKey?.includes('\n'),
    startsWithDollar: apiKey?.startsWith('$'),
    charCodes: apiKey ? apiKey.split('').slice(0, 50).map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`).join(',') : 'N/A'
  })
}