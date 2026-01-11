'use client'

import { useRef, useState } from 'react'
import { UploadIcon, CloseIcon } from '@/components/icons'

export interface FileDropzoneProps {
  /** Accepted file types (e.g., "video/*", "image/*", ".pdf,.doc") */
  accept?: string
  /** Maximum file size in bytes */
  maxSize?: number
  /** Current file (controlled) */
  file?: File | null
  /** Called when file is selected */
  onFileSelect: (file: File | null) => void
  /** Upload progress (0-100), shows progress bar when provided */
  progress?: number | null
  /** Label text */
  label?: string
  /** Helper text shown below dropzone */
  helperText?: string
  /** Placeholder text when no file selected */
  placeholder?: string
  /** Error message */
  error?: string | null
  /** Disabled state */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

export function FileDropzone({
  accept,
  maxSize,
  file,
  onFileSelect,
  progress,
  label,
  helperText,
  placeholder = 'Click or drag to upload',
  error,
  disabled = false,
  className = '',
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const displayError = error || localError

  const validateFile = (f: File): string | null => {
    // Check file type
    if (accept) {
      const acceptedTypes = accept.split(',').map((t) => t.trim())
      const isValidType = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          // Extension match
          return f.name.toLowerCase().endsWith(type.toLowerCase())
        } else if (type.endsWith('/*')) {
          // MIME type wildcard (e.g., "video/*")
          const category = type.slice(0, -2)
          return f.type.startsWith(category + '/')
        } else {
          // Exact MIME type
          return f.type === type
        }
      })
      if (!isValidType) {
        return `File type not accepted. Please upload ${accept}`
      }
    }

    // Check file size
    if (maxSize && f.size > maxSize) {
      const sizeMB = (maxSize / (1024 * 1024)).toFixed(0)
      return `File too large. Maximum size is ${sizeMB}MB`
    }

    return null
  }

  const handleFile = (f: File) => {
    setLocalError(null)
    const validationError = validateFile(f)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    onFileSelect(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFile(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFile(selectedFile)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLocalError(null)
    onFileSelect(null)
  }

  const handleClick = () => {
    if (!disabled && !file) {
      inputRef.current?.click()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isUploading =
    progress !== null && progress !== undefined && progress < 100

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : file ? 'cursor-default' : 'cursor-pointer'}
          ${isDragging ? 'border-accent bg-accent/10' : ''}
          ${file ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 hover:border-white/40'}
          ${displayError ? 'border-error/50 bg-error/10' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        {file ? (
          // File selected state
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-green-400 truncate">
                  {file.name}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                  aria-label="Remove file"
                >
                  <CloseIcon size={20} />
                </button>
              )}
            </div>

            {/* Progress bar */}
            {progress !== null && progress !== undefined && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-400">
                    {progress < 100 ? 'Uploading...' : 'Uploaded'}
                  </span>
                  <span className="text-accent">{progress}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          // Empty state
          <div className="p-6 text-center">
            <UploadIcon className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-300">{placeholder}</p>
            {helperText && (
              <p className="text-sm text-gray-500 mt-1">{helperText}</p>
            )}
          </div>
        )}
      </div>

      {displayError && (
        <p className="text-sm text-error mt-2">{displayError}</p>
      )}
    </div>
  )
}
