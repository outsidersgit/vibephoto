'use client'


interface ModelStatsProps {
  stats: {
    totalGenerations: number
    averageProcessingTime: number
    totalCreditsUsed: number
    successRate: number
    popularPrompts: Array<{
      prompt: string
      count: number
    }>
  }
}

export function ModelStats({ stats }: ModelStatsProps) {
  const formatTime = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`
    return `${(milliseconds / 60000).toFixed(1)}min`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
      <div className="bg-slate-600 border border-slate-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200 tracking-wide">Total Generations</p>
          <div className="text-3xl font-light text-white">{stats.totalGenerations}</div>
          <p className="text-xs text-slate-300 font-light">
            Images created with this model
          </p>
        </div>
      </div>

      <div className="bg-slate-600 border border-slate-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200 tracking-wide">Processing Time</p>
          <div className="text-3xl font-light text-white">
            {formatTime(stats.averageProcessingTime)}
          </div>
          <p className="text-xs text-slate-300 font-light">
            Average generation time
          </p>
        </div>
      </div>

      <div className="bg-slate-600 border border-slate-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200 tracking-wide">Credits Used</p>
          <div className="text-3xl font-light text-white">{stats.totalCreditsUsed}</div>
          <p className="text-xs text-slate-300 font-light">
            Total credits consumed
          </p>
        </div>
      </div>

      <div className="bg-slate-600 border border-slate-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200 tracking-wide">Success Rate</p>
          <div className="text-3xl font-light text-white">{stats.successRate}%</div>
          <p className="text-xs text-slate-300 font-light">
            Successful generations
          </p>
        </div>
      </div>

      {/* Popular Prompts */}
      {stats.popularPrompts.length > 0 && (
        <div className="md:col-span-2 lg:col-span-4 bg-slate-600 border border-slate-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
          <h3 className="text-lg font-medium text-slate-200 tracking-wide mb-4">Most Used Prompts</h3>
          <div className="space-y-3">
            {stats.popularPrompts.slice(0, 5).map((prompt, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-300 truncate flex-1 mr-4 font-light">
                  {prompt.prompt}
                </span>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full font-medium">
                  {prompt.count} uses
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}