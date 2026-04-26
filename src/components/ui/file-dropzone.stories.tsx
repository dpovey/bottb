import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { FileDropzone } from './file-dropzone'

const meta: Meta<typeof FileDropzone> = {
  title: 'Forms/FileDropzone',
  component: FileDropzone,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Drag-and-drop file upload component with progress bar support. Supports file type validation, size limits, and upload progress display.',
      },
    },
  },
  argTypes: {
    accept: {
      control: 'text',
      description: 'Accepted file types (e.g., "video/*", "image/*", ".pdf")',
    },
    maxSize: {
      control: 'number',
      description: 'Maximum file size in bytes',
    },
    progress: {
      control: { type: 'range', min: 0, max: 100 },
      description: 'Upload progress percentage (0-100)',
    },
    label: {
      control: 'text',
      description: 'Label text above the dropzone',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text when no file selected',
    },
    helperText: {
      control: 'text',
      description: 'Helper text below the dropzone',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof FileDropzone>

// Interactive wrapper for controlled state
function InteractiveDropzone(
  props: Omit<
    React.ComponentProps<typeof FileDropzone>,
    'file' | 'onFileSelect'
  >
) {
  const [file, setFile] = useState<File | null>(null)
  return <FileDropzone {...props} file={file} onFileSelect={setFile} />
}

// Default empty state
export const Default: Story = {
  render: () => (
    <InteractiveDropzone
      label="Upload File"
      placeholder="Click or drag to upload"
      helperText="Supports all file types"
    />
  ),
}

// Video upload specific
export const VideoUpload: Story = {
  render: () => (
    <InteractiveDropzone
      label="Video File"
      accept="video/*"
      maxSize={1024 * 1024 * 1024}
      placeholder="Click or drag to upload your video"
      helperText="MP4, MOV, or other video formats • Max 1GB"
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Configured for video file uploads with type and size validation.',
      },
    },
  },
}

// Image upload
export const ImageUpload: Story = {
  render: () => (
    <InteractiveDropzone
      label="Photo"
      accept="image/*"
      maxSize={10 * 1024 * 1024}
      placeholder="Click or drag to upload an image"
      helperText="PNG, JPG, or WebP • Max 10MB"
    />
  ),
}

// With file selected
export const WithFile: Story = {
  render: () => {
    // Create a mock file for display
    const mockFile = new File([''], 'my-video.mp4', { type: 'video/mp4' })
    Object.defineProperty(mockFile, 'size', { value: 157286400 }) // 150MB

    return (
      <FileDropzone
        label="Video File"
        file={mockFile}
        onFileSelect={() => {}}
        placeholder="Click or drag to upload"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'State after a file has been selected, showing file name and size.',
      },
    },
  },
}

// With upload progress
export const UploadInProgress: Story = {
  render: () => {
    const mockFile = new File([''], 'event-highlights.mp4', {
      type: 'video/mp4',
    })
    Object.defineProperty(mockFile, 'size', { value: 314572800 }) // 300MB

    return (
      <FileDropzone
        label="Video File"
        file={mockFile}
        onFileSelect={() => {}}
        progress={47}
        placeholder="Click or drag to upload"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows upload progress bar when progress prop is provided.',
      },
    },
  },
}

// Upload complete
export const UploadComplete: Story = {
  render: () => {
    const mockFile = new File([''], 'band-performance.mp4', {
      type: 'video/mp4',
    })
    Object.defineProperty(mockFile, 'size', { value: 209715200 }) // 200MB

    return (
      <FileDropzone
        label="Video File"
        file={mockFile}
        onFileSelect={() => {}}
        progress={100}
        placeholder="Click or drag to upload"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Upload complete state with 100% progress.',
      },
    },
  },
}

// With error
export const WithError: Story = {
  render: () => (
    <InteractiveDropzone
      label="Video File"
      accept="video/*"
      maxSize={100 * 1024 * 1024}
      placeholder="Click or drag to upload"
      error="File too large. Maximum size is 100MB"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Error state with validation message.',
      },
    },
  },
}

// Disabled state
export const Disabled: Story = {
  render: () => (
    <FileDropzone
      label="Video File"
      file={null}
      onFileSelect={() => {}}
      placeholder="Upload disabled"
      disabled
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled dropzone that cannot accept files.',
      },
    },
  },
}

// Without label
export const NoLabel: Story = {
  render: () => (
    <InteractiveDropzone
      placeholder="Drop files here"
      helperText="Any file type accepted"
    />
  ),
}

// Progress showcase
export const ProgressStates: Story = {
  render: () => {
    const mockFile = new File([''], 'video.mp4', { type: 'video/mp4' })
    Object.defineProperty(mockFile, 'size', { value: 104857600 })

    return (
      <div className="space-y-4">
        <FileDropzone
          label="0% - Starting"
          file={mockFile}
          onFileSelect={() => {}}
          progress={0}
        />
        <FileDropzone
          label="25% - In Progress"
          file={mockFile}
          onFileSelect={() => {}}
          progress={25}
        />
        <FileDropzone
          label="75% - Almost Done"
          file={mockFile}
          onFileSelect={() => {}}
          progress={75}
        />
        <FileDropzone
          label="100% - Complete"
          file={mockFile}
          onFileSelect={() => {}}
          progress={100}
        />
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Various progress states from 0% to 100%.',
      },
    },
  },
}
