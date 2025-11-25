'use client'

import { useState, ReactNode } from 'react'

interface GenderTabsProps {
  maleContent: ReactNode
  femaleContent: ReactNode
}

export function GenderTabs({ maleContent, femaleContent }: GenderTabsProps) {
  const [activeTab, setActiveTab] = useState<'male' | 'female'>('male')

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('male')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'male'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Masculino
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('female')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'female'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Feminino
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'male' && maleContent}
        {activeTab === 'female' && femaleContent}
      </div>
    </div>
  )
}
