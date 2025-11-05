'use client'

import React from 'react'

interface GenerationSettingsProps {
  settings: {
    aspectRatio: string
    resolution: string
    variations: number
    strength: number
    seed?: number
    style: string
    // FLUX quality parameters
    steps?: number
    guidance_scale?: number
    raw_mode?: boolean
    output_quality?: number
    safety_tolerance?: number
    output_format?: string
    // AI Provider selection
    aiProvider?: 'replicate' | 'astria'
    // Astria enhancement parameters
    astria_super_resolution?: boolean
    astria_inpaint_faces?: boolean
    astria_face_correct?: boolean
    astria_face_swap?: boolean
    astria_hires_fix?: boolean
    astria_model_type?: 'faceid' | 'sd15' | 'sdxl1' | 'flux-lora'
  }
  onSettingsChange: (settings: any) => void
  userPlan: string
}

export function GenerationSettings({ settings, onSettingsChange, userPlan }: GenerationSettingsProps) {
  const aspectRatios = [
    { value: '1:1', label: 'Quadrado (1:1)', free: true },
    { value: '4:3', label: 'Padrão (4:3)', free: true },
    { value: '3:4', label: 'Retrato (3:4)', free: true },
    { value: '16:9', label: 'Paisagem (16:9)', free: false },
    { value: '9:16', label: 'Vertical (9:16)', free: false }
  ]

  // Auto-calculate resolution based on aspect ratio
  const calculateResolution = (aspectRatio: string) => {
    const baseSize = 1024 // Base size for 1:1 ratio

    switch (aspectRatio) {
      case '1:1':
        return `${baseSize}x${baseSize}`
      case '4:3':
        return `${Math.round(baseSize * 4/3)}x${baseSize}` // ~1365x1024
      case '3:4':
        return `${baseSize}x${Math.round(baseSize * 4/3)}` // 1024x~1365
      case '16:9':
        return `${Math.round(baseSize * 16/9)}x${baseSize}` // ~1820x1024
      case '9:16':
        return `${baseSize}x${Math.round(baseSize * 16/9)}` // 1024x~1820
      default:
        return `${baseSize}x${baseSize}`
    }
  }

  const updateSetting = (key: string, value: any) => {
    const updatedSettings = {
      ...settings,
      [key]: value
    }

    // Auto-update resolution when aspect ratio changes
    if (key === 'aspectRatio') {
      updatedSettings.resolution = calculateResolution(value)
    }

    onSettingsChange(updatedSettings)
  }

  // Force Astria as default provider
  const forceAstriaProvider = () => {
    if (settings.aiProvider !== 'astria') {
      updateSetting('aiProvider', 'astria')
    }
  }

  // Set Astria as default and initialize resolution on component mount
  React.useEffect(() => {
    forceAstriaProvider()
    // Initialize resolution based on current aspect ratio
    const currentResolution = calculateResolution(settings.aspectRatio)
    if (settings.resolution !== currentResolution) {
      updateSetting('resolution', currentResolution)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Variations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Variações
        </label>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => updateSetting('variations', num)}
              className={`p-2 border rounded text-center transition-colors text-sm ${
                settings.variations === num
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-gray-200 text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="font-medium">{num}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Formato
        </label>
        <select
          value={settings.aspectRatio}
          onChange={(e) => updateSetting('aspectRatio', e.target.value)}
          className="w-full p-2 bg-gray-200 border border-gray-900 rounded text-gray-900 text-sm focus:border-[#667EEA] focus:ring-2 focus:ring-[#667EEA]/20"
        >
          {aspectRatios.map((ratio) => (
            <option key={ratio.value} value={ratio.value}>
              {ratio.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}