'use client'

import { useState } from 'react'
import { Wand2, Lightbulb } from 'lucide-react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  examples?: string[]
  className?: string
  disabled?: boolean
}

export function PromptInput({ 
  value, 
  onChange, 
  placeholder = 'Describe what you want to do with the image...', 
  examples = [],
  className = '',
  disabled = false
}: PromptInputProps) {
  const [showExamples, setShowExamples] = useState(false)

  const defaultExamples = [
    'Add a beautiful sunset sky',
    'Remove the background',
    'Make it look like a painting',
    'Add more vibrant colors',
    'Remove the person in the background',
    'Add mountains in the distance',
    'Make it black and white',
    'Add falling snow'
  ]

  const allExamples = examples.length > 0 ? examples : defaultExamples

  const handleExampleClick = (example: string) => {
    onChange(example)
    setShowExamples(false)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Input Area */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Wand2 className="h-5 w-5 text-gray-400" />
        </div>
        
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={`
            block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg 
            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:border-transparent resize-none
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
          `}
        />
        
        {/* Examples Button */}
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          disabled={disabled}
          className={`
            absolute inset-y-0 right-0 pr-3 flex items-center
            ${disabled ? 'cursor-not-allowed' : 'hover:text-blue-600'}
          `}
        >
          <Lightbulb className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Character Count */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>{value.length}/1000 characters</span>
        {value.length > 900 && (
          <span className="text-orange-500 font-medium">
            {1000 - value.length} characters remaining
          </span>
        )}
      </div>

      {/* Examples Panel */}
      {showExamples && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" />
            Example prompts
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                disabled={disabled}
                className={`
                  text-left px-3 py-2 text-sm bg-white border border-gray-200 
                  rounded-md transition-colors
                  ${disabled 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                  }
                `}
              >
                {example}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setShowExamples(false)}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Hide examples
          </button>
        </div>
      )}

      {/* Validation Messages */}
      {value.length > 1000 && (
        <p className="text-sm text-red-600">
          Prompt is too long. Please keep it under 1000 characters.
        </p>
      )}
      
      {value.trim().length === 0 && value.length > 0 && (
        <p className="text-sm text-orange-600">
          Please enter a meaningful prompt.
        </p>
      )}
    </div>
  )
}