'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { 
  X, 
  Crown, 
  Star, 
  Clock, 
  DollarSign,
  Filter,
  TrendingUp,
  Users
} from 'lucide-react'

interface PackageFiltersProps {
  onClose: () => void
}

export function PackageFilters({ onClose }: PackageFiltersProps) {
  const [priceRange, setPriceRange] = useState([0, 100])
  const [ratingFilter, setRatingFilter] = useState(0)
  const [showPremiumOnly, setShowPremiumOnly] = useState(false)
  const [showPopularOnly, setShowPopularOnly] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const popularTags = [
    'professional', 'headshot', 'business', 'corporate',
    'casual', 'lifestyle', 'social', 'instagram',
    'dating', 'creative', 'artistic', 'fantasy',
    'anime', 'warrior', 'modern', 'trendy'
  ]

  const categories = [
    { id: 'PROFESSIONAL', name: 'Professional', icon: '👔' },
    { id: 'SOCIAL', name: 'Social Media', icon: '📱' },
    { id: 'FANTASY', name: 'Fantasy', icon: '🏰' },
    { id: 'ARTISTIC', name: 'Artistic', icon: '🎨' }
  ]

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const clearAllFilters = () => {
    setPriceRange([0, 50])
    setRatingFilter(0)
    setShowPremiumOnly(false)
    setShowPopularOnly(false)
    setSelectedTags([])
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center text-white">
            <Filter className="w-5 h-5 mr-2 text-blue-400" />
            Filters
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-700">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div>
          <h3 className="font-medium text-white mb-3 flex items-center">
            <DollarSign className="w-4 h-4 mr-2 text-green-400" />
            Price Range
          </h3>
          <div className="space-y-3">
            <Slider
              value={priceRange}
              onValueChange={setPriceRange}
              max={50}
              min={0}
              step={1}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>R$ {priceRange[0]}</span>
              <span>R$ {priceRange[1]}</span>
            </div>
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <h3 className="font-medium text-white mb-3 flex items-center">
            <Star className="w-4 h-4 mr-2 text-yellow-400" />
            Minimum Rating
          </h3>
          <div className="space-y-2">
            {[4.5, 4.0, 3.5, 3.0].map((rating) => (
              <button
                key={rating}
                onClick={() => setRatingFilter(rating)}
                className={`w-full p-2 text-left border rounded-lg transition-colors ${
                  ratingFilter === rating
                    ? 'border-blue-500 bg-blue-900/20 text-blue-300'
                    : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm">{rating}+ stars</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Filters */}
        <div>
          <h3 className="font-medium text-white mb-3">Quick Filters</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Crown className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-300">Premium only</span>
              </div>
              <Switch
                checked={showPremiumOnly}
                onCheckedChange={setShowPremiumOnly}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">Popular (90%+)</span>
              </div>
              <Switch
                checked={showPopularOnly}
                onCheckedChange={setShowPopularOnly}
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="font-medium text-white mb-3">Categories</h3>
          <div className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.id}
                className="w-full p-3 text-left border border-gray-600 rounded-lg hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{category.icon}</span>
                  <span className="text-sm text-gray-300">{category.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="font-medium text-white mb-3">Popular Tags</h3>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className={`text-xs ${selectedTags.includes(tag) 
                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                  : "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
                size="sm"
                onClick={() => toggleTag(tag)}
              >
                #{tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Estimated Time */}
        <div>
          <h3 className="font-medium text-white mb-3 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-purple-400" />
            Generation Time
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Under 2 minutes', value: 'fast' },
              { label: '2-3 minutes', value: 'medium' },
              { label: '3+ minutes', value: 'slow' }
            ].map((option) => (
              <button
                key={option.value}
                className="w-full p-2 text-left border border-gray-600 rounded-lg hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm text-gray-300">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Usage Stats */}
        <div>
          <h3 className="font-medium text-white mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2 text-blue-400" />
            Usage
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Trending (1000+ uses)', value: 'trending' },
              { label: 'Popular (500+ uses)', value: 'popular' },
              { label: 'New (under 100 uses)', value: 'new' }
            ].map((option) => (
              <button
                key={option.value}
                className="w-full p-2 text-left border border-gray-600 rounded-lg hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm text-gray-300">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Applied Filters Summary */}
        {(priceRange[0] > 0 || priceRange[1] < 100 || ratingFilter > 0 || showPremiumOnly || showPopularOnly || selectedTags.length > 0) && (
          <div className="pt-4 border-t border-gray-700">
            <h4 className="font-medium text-white mb-2">Applied Filters</h4>
            <div className="space-y-2">
              {priceRange[0] > 0 || priceRange[1] < 100 ? (
                <Badge variant="secondary" className="bg-gray-700 text-gray-300 border-gray-600">
                  Preço: R$ {priceRange[0]} - R$ {priceRange[1]}
                </Badge>
              ) : null}
              
              {ratingFilter > 0 && (
                <Badge variant="secondary" className="bg-gray-700 text-gray-300 border-gray-600">
                  Rating: {ratingFilter}+ stars
                </Badge>
              )}
              
              {showPremiumOnly && (
                <Badge variant="secondary" className="bg-gray-700 text-gray-300 border-gray-600">
                  Premium only
                </Badge>
              )}
              
              {showPopularOnly && (
                <Badge variant="secondary" className="bg-gray-700 text-gray-300 border-gray-600">
                  Popular only
                </Badge>
              )}
              
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-gray-700 text-gray-300 border-gray-600">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Clear Filters */}
        <div className="pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={clearAllFilters}
          >
            Clear All Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}