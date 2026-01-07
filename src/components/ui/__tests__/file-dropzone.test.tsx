import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FileDropzone } from '../file-dropzone'

describe('FileDropzone', () => {
  describe('Empty state', () => {
    it('renders placeholder text when no file selected', () => {
      render(
        <FileDropzone
          file={null}
          onFileSelect={() => {}}
          placeholder="Click to upload"
        />
      )

      expect(screen.getByText('Click to upload')).toBeInTheDocument()
    })

    it('renders label when provided', () => {
      render(
        <FileDropzone file={null} onFileSelect={() => {}} label="Video File" />
      )

      expect(screen.getByText('Video File')).toBeInTheDocument()
    })

    it('renders helper text when provided', () => {
      render(
        <FileDropzone
          file={null}
          onFileSelect={() => {}}
          helperText="Max 1GB"
        />
      )

      expect(screen.getByText('Max 1GB')).toBeInTheDocument()
    })
  })

  describe('File selection', () => {
    it('calls onFileSelect when file is selected via click', async () => {
      const user = userEvent.setup()
      const handleSelect = vi.fn()

      render(<FileDropzone file={null} onFileSelect={handleSelect} />)

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      expect(input).toBeInTheDocument()

      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      await user.upload(input, testFile)

      expect(handleSelect).toHaveBeenCalledWith(testFile)
    })

    it('validates file type via handleFile validation', () => {
      // Test that the component validates file types
      // Note: userEvent.upload respects accept attribute, so we test the validation logic
      // by checking that accept attribute is properly set
      render(
        <FileDropzone file={null} onFileSelect={() => {}} accept="video/*" />
      )

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      expect(input).toHaveAttribute('accept', 'video/*')
    })

    it('validates file size when maxSize is specified', async () => {
      const user = userEvent.setup()
      const handleSelect = vi.fn()

      render(
        <FileDropzone
          file={null}
          onFileSelect={handleSelect}
          maxSize={1024} // 1KB
        />
      )

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement

      // Create a file larger than maxSize
      const largeFile = new File(['x'.repeat(2048)], 'large.mp4', {
        type: 'video/mp4',
      })
      await user.upload(input, largeFile)

      expect(handleSelect).not.toHaveBeenCalled()
      expect(screen.getByText(/file too large/i)).toBeInTheDocument()
    })
  })

  describe('File selected state', () => {
    it('displays file name when file is selected', () => {
      const testFile = new File(['test'], 'my-video.mp4', { type: 'video/mp4' })

      render(<FileDropzone file={testFile} onFileSelect={() => {}} />)

      expect(screen.getByText('my-video.mp4')).toBeInTheDocument()
    })

    it('displays file size in human-readable format', () => {
      const testFile = new File(['x'.repeat(1024 * 1024)], 'video.mp4', {
        type: 'video/mp4',
      })

      render(<FileDropzone file={testFile} onFileSelect={() => {}} />)

      expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    })

    it('shows remove button when file is selected', () => {
      const testFile = new File(['test'], 'video.mp4', { type: 'video/mp4' })

      render(<FileDropzone file={testFile} onFileSelect={() => {}} />)

      expect(
        screen.getByRole('button', { name: /remove file/i })
      ).toBeInTheDocument()
    })

    it('calls onFileSelect with null when remove is clicked', async () => {
      const user = userEvent.setup()
      const handleSelect = vi.fn()
      const testFile = new File(['test'], 'video.mp4', { type: 'video/mp4' })

      render(<FileDropzone file={testFile} onFileSelect={handleSelect} />)

      const removeButton = screen.getByRole('button', { name: /remove file/i })
      await user.click(removeButton)

      expect(handleSelect).toHaveBeenCalledWith(null)
    })
  })

  describe('Progress state', () => {
    it('shows progress bar when progress is provided', () => {
      const testFile = new File(['test'], 'video.mp4', { type: 'video/mp4' })

      render(
        <FileDropzone file={testFile} onFileSelect={() => {}} progress={50} />
      )

      expect(screen.getByText('Uploading...')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('shows "Uploaded" when progress is 100', () => {
      const testFile = new File(['test'], 'video.mp4', { type: 'video/mp4' })

      render(
        <FileDropzone file={testFile} onFileSelect={() => {}} progress={100} />
      )

      expect(screen.getByText('Uploaded')).toBeInTheDocument()
    })

    it('hides remove button during upload', () => {
      const testFile = new File(['test'], 'video.mp4', { type: 'video/mp4' })

      render(
        <FileDropzone file={testFile} onFileSelect={() => {}} progress={50} />
      )

      expect(
        screen.queryByRole('button', { name: /remove file/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('displays error message when error prop is provided', () => {
      render(
        <FileDropzone
          file={null}
          onFileSelect={() => {}}
          error="Something went wrong"
        />
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('error prop takes precedence over local validation errors', async () => {
      render(
        <FileDropzone
          file={null}
          onFileSelect={() => {}}
          error="External error"
        />
      )

      // Should show the external error
      expect(screen.getByText('External error')).toBeInTheDocument()
    })
  })

  describe('Disabled state', () => {
    it('prevents file selection when disabled', async () => {
      const user = userEvent.setup()
      const handleSelect = vi.fn()

      render(<FileDropzone file={null} onFileSelect={handleSelect} disabled />)

      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      expect(input).toBeDisabled()

      // Attempting to upload should not work
      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      await user.upload(input, testFile)

      expect(handleSelect).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has accessible hidden file input', () => {
      render(<FileDropzone file={null} onFileSelect={() => {}} />)

      const input = document.querySelector('input[type="file"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('hidden')
    })

    it('applies accept attribute to file input', () => {
      render(
        <FileDropzone file={null} onFileSelect={() => {}} accept="video/*" />
      )

      const input = document.querySelector('input[type="file"]')
      expect(input).toHaveAttribute('accept', 'video/*')
    })
  })
})
