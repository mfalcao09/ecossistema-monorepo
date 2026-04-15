'use client'
interface ProgressBarProps {
  progresso: number // 0-100
  label?: string
}

export function ProgressBar({ progresso, label }: ProgressBarProps) {
  // Clamp progress to 0-100
  const clampedProgress = Math.min(Math.max(progresso, 0), 100)

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}

      <div className="flex items-center gap-3">
        {/* Progress Bar */}
        <div className="flex-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>

        {/* Percentage */}
        <div className="text-sm font-semibold text-gray-900 min-w-[3rem] text-right">
          {Math.round(clampedProgress)}%
        </div>
      </div>
    </div>
  )
}
