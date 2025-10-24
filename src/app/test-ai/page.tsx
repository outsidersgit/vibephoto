'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Bot, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Zap,
  Clock
} from 'lucide-react'

interface TrainingJob {
  id: string
  status: string
  estimatedTime?: number
  cost: number
  progress?: number
}

interface GenerationJob {
  id: string
  status: string
  estimatedTime?: number
  cost: number
  urls?: string[]
  prompt: string
}

export default function TestAIPage() {
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([])
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([])
  const [isTraining, setIsTraining] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock model data for testing
  const mockModel = {
    id: 'test-model-123',
    name: 'Test Model',
    status: 'READY',
    triggerWord: 'TOK123'
  }

  const startTraining = async () => {
    setIsTraining(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: mockModel.id,
          triggerWord: 'TOK123',
          classWord: 'person',
          trainingParams: {
            steps: 500, // Reduced for testing
            learningRate: 1e-4,
            batchSize: 1,
            resolution: 512
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        const newJob: TrainingJob = {
          id: data.data.trainingId,
          status: data.data.status,
          estimatedTime: data.data.estimatedTime,
          cost: data.data.cost
        }

        setTrainingJobs(prev => [...prev, newJob])
        
        // Poll for status updates
        pollTrainingStatus(newJob.id)
      } else {
        setError(data.error || 'Training failed to start')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Training failed')
    } finally {
      setIsTraining(false)
    }
  }

  const generateImage = async () => {
    const prompt = (document.getElementById('prompt') as HTMLInputElement)?.value
    if (!prompt) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: mockModel.id,
          prompt,
          generationParams: {
            width: 512,
            height: 512,
            steps: 20,
            guidance_scale: 7.5,
            num_outputs: 1
          },
          variations: 1
        })
      })

      const data = await response.json()

      if (data.success) {
        const newJob: GenerationJob = {
          id: data.data.jobId,
          status: data.data.status,
          estimatedTime: data.data.estimatedTime,
          cost: data.data.cost,
          prompt
        }

        setGenerationJobs(prev => [...prev, newJob])
        
        // Poll for status updates
        pollGenerationStatus(data.data.generationId)
      } else {
        setError(data.error || 'Generation failed to start')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const pollTrainingStatus = async (trainingId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ai/train?trainingId=${trainingId}`)
        const data = await response.json()

        if (data.success) {
          setTrainingJobs(prev => 
            prev.map(job => 
              job.id === trainingId 
                ? { ...job, status: data.data.status, progress: data.data.progress }
                : job
            )
          )

          // Stop polling if completed
          if (data.data.status === 'succeeded' || data.data.status === 'failed') {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Failed to poll training status:', error)
      }
    }, 5000) // Poll every 5 seconds
  }

  const pollGenerationStatus = async (generationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ai/generate?generationId=${generationId}`)
        const data = await response.json()

        if (data.success) {
          setGenerationJobs(prev => 
            prev.map(job => 
              job.id === data.data.id || job.id === generationId
                ? { 
                    ...job, 
                    status: data.data.status, 
                    urls: data.data.urls 
                  }
                : job
            )
          )

          // Stop polling if completed
          if (data.data.status === 'succeeded' || data.data.status === 'failed') {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Failed to poll generation status:', error)
      }
    }, 3000) // Poll every 3 seconds
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'starting':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'succeeded':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'starting':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'succeeded':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Bot className="w-8 h-8 mr-3" />
            AI System Test
          </h1>
          <p className="text-gray-600">
            Test the AI training and generation functionality
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Training Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Model Training
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Mock Model</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Name: {mockModel.name}</div>
                  <div>Status: <Badge variant="secondary">{mockModel.status}</Badge></div>
                  <div>Trigger Word: {mockModel.triggerWord}</div>
                </div>
              </div>

              <Button
                onClick={startTraining}
                disabled={isTraining}
                className="w-full"
              >
                {isTraining ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Training...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>

              {/* Training Jobs */}
              {trainingJobs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Training Jobs</h4>
                  {trainingJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(job.status)}
                          <Badge variant="secondary" className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          Cost: {job.cost} credits
                        </span>
                      </div>
                      
                      {job.status === 'processing' && job.progress && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{job.progress}%</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2">
                        ID: {job.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="w-5 h-5 mr-2" />
                Image Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt
                  </label>
                  <Textarea
                    id="prompt"
                    placeholder="A professional headshot of TOK123 person in business attire..."
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>Size: 512x512</div>
                  <div>Steps: 20</div>
                  <div>Guidance: 7.5</div>
                  <div>Variations: 1</div>
                </div>
              </div>

              <Button
                onClick={generateImage}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>

              {/* Generation Jobs */}
              {generationJobs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Generation Jobs</h4>
                  {generationJobs.map((job) => (
                    <div key={job.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(job.status)}
                          <Badge variant="secondary" className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          Cost: {job.cost} credits
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 mb-2">
                        {job.prompt}
                      </div>

                      {job.urls && job.urls.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {job.urls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`Generated image ${index + 1}`}
                              className="w-full aspect-square object-cover rounded"
                            />
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2">
                        ID: {job.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Provider Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600">AI Provider</div>
                <Badge variant="outline">
                  {process.env.NEXT_PUBLIC_AI_PROVIDER || 'local'}
                </Badge>
              </div>
              <div>
                <div className="text-gray-600">Training Cost</div>
                <div>~5-50 credits</div>
              </div>
              <div>
                <div className="text-gray-600">Generation Cost</div>
                <div>~1-5 credits</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}