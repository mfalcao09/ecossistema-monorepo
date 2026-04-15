'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Check, AlertTriangle } from 'lucide-react'
import type { NivelConfianca } from '@/types/ia'

interface CampoIAProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  // IA props
  preenchidoPorIA?: boolean
  confianca?: NivelConfianca
  fonteIA?: string
}

export function CampoIA({
  label,
  name,
  value,
  onChange,
  type = 'text',
  options,
  placeholder,
  required,
  disabled,
  preenchidoPorIA,
  confianca,
  fonteIA,
}: CampoIAProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [showSparkle, setShowSparkle] = useState(false)
  const [isManuallyEdited, setIsManuallyEdited] = useState(false)

  // Trigger animation when preenchidoPorIA changes
  useEffect(() => {
    if (preenchidoPorIA && !isManuallyEdited) {
      setIsAnimating(true)
      setShowSparkle(true)

      // Fade animation after 3 seconds
      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [preenchidoPorIA, isManuallyEdited])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(e.target.value)
    setIsManuallyEdited(true)
    setShowSparkle(false)
    setIsAnimating(false)
  }

  // Get border color based on confidence
  const getBorderColor = () => {
    if (!preenchidoPorIA || isManuallyEdited) {
      return 'border-gray-300'
    }

    switch (confianca) {
      case 'alta':
        return 'border-green-500'
      case 'media':
        return 'border-yellow-500'
      case 'baixa':
        return 'border-red-500'
      default:
        return 'border-gray-300'
    }
  }

  const getFocusRingColor = () => {
    if (!preenchidoPorIA || isManuallyEdited) {
      return 'focus:ring-blue-500'
    }

    switch (confianca) {
      case 'alta':
        return 'focus:ring-green-500'
      case 'media':
        return 'focus:ring-yellow-500'
      case 'baixa':
        return 'focus:ring-red-500'
      default:
        return 'focus:ring-blue-500'
    }
  }

  const baseInputClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all ${getBorderColor()} ${getFocusRingColor()}`

  const animationClasses = isAnimating
    ? 'animate-pulse border-2'
    : showSparkle && !isManuallyEdited
      ? 'border-2'
      : ''

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {/* Sparkle Icon + Tooltip */}
        {showSparkle && !isManuallyEdited && (
          <div className="relative group">
            <button
              type="button"
              className="p-1 text-blue-500 hover:text-blue-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Tooltip */}
            <div className="absolute right-0 top-6 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Extraído de: {fonteIA}
            </div>
          </div>
        )}
      </div>

      {type === 'text' && (
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`${baseInputClasses} ${animationClasses}`}
        />
      )}

      {type === 'date' && (
        <input
          id={name}
          name={name}
          type="date"
          value={value}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          className={`${baseInputClasses} ${animationClasses}`}
        />
      )}

      {type === 'select' && options && (
        <select
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          className={`${baseInputClasses} ${animationClasses}`}
        >
          <option value="">Selecione uma opção</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {/* Confidence Indicator */}
      {preenchidoPorIA && !isManuallyEdited && confianca && (
        <div className="flex items-center gap-1 text-xs">
          {confianca === 'alta' && (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="w-3 h-3" />
              Alta confiança
            </div>
          )}
          {confianca === 'media' && (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="w-3 h-3" />
              Média confiança
            </div>
          )}
          {confianca === 'baixa' && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="w-3 h-3" />
              Baixa confiança - Revise
            </div>
          )}
        </div>
      )}
    </div>
  )
}
