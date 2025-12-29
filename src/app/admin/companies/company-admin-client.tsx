'use client'

import { useState } from 'react'
import { CompanyWithStats } from '@/lib/db-types'
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
  PlusIcon,
} from '@/components/icons'
import { VinylSpinner, CompanyIcon } from '@/components/ui'

interface CompanyAdminClientProps {
  initialCompanies: CompanyWithStats[]
}

export function CompanyAdminClient({
  initialCompanies,
}: CompanyAdminClientProps) {
  const [companies, setCompanies] =
    useState<CompanyWithStats[]>(initialCompanies)
  const [isAddingCompany, setIsAddingCompany] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newIconUrl, setNewIconUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper to generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: newSlug || generateSlug(newName),
          website: newWebsite || null,
          icon_url: newIconUrl || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCompanies([
          ...companies,
          { ...data.company, band_count: 0, event_count: 0 },
        ])
        setNewName('')
        setNewSlug('')
        setNewWebsite('')
        setNewIconUrl('')
        setIsAddingCompany(false)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add company')
      }
    } catch (err) {
      setError('Failed to add company')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCompany = async (
    slug: string,
    updates: {
      name?: string
      website?: string | null
      icon_url?: string | null
    }
  ) => {
    try {
      const response = await fetch(`/api/companies/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setCompanies(
          companies.map((c) =>
            c.slug === slug ? { ...c, ...data.company } : c
          )
        )
        return true
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to update company')
        return false
      }
    } catch (err) {
      alert('Failed to update company')
      console.error(err)
      return false
    }
  }

  const handleDeleteCompany = async (slug: string) => {
    const company = companies.find((c) => c.slug === slug)
    if (!company) return

    if (
      !confirm(
        `Are you sure you want to delete "${company.name}"? This cannot be undone.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/companies/${slug}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCompanies(companies.filter((c) => c.slug !== slug))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete company')
      }
    } catch (err) {
      alert('Failed to delete company')
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Company Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsAddingCompany(true)}
          className="bg-accent hover:bg-accent-light text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusIcon size={20} />
          Add Company
        </button>
      </div>

      {/* Add Company Form */}
      {isAddingCompany && (
        <div className="bg-elevated rounded-2xl p-6 border border-white/5">
          <h2 className="text-xl font-bold text-white mb-4">Add New Company</h2>
          <form onSubmit={handleAddCompany} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    if (!newSlug) {
                      // Auto-generate slug as user types
                    }
                  }}
                  placeholder="e.g., Dance Corp"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Slug (URL-friendly ID)
                </label>
                <input
                  type="text"
                  value={newSlug || generateSlug(newName)}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="auto-generated from name"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Icon URL
                </label>
                <input
                  type="url"
                  value={newIconUrl}
                  onChange={(e) => setNewIconUrl(e.target.value)}
                  placeholder="https://... (small icon for badges)"
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent hover:bg-accent-light text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Company'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCompany(false)
                  setError(null)
                  setNewName('')
                  setNewSlug('')
                  setNewWebsite('')
                  setNewIconUrl('')
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Companies List */}
      <div className="bg-elevated rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">
            Companies ({companies.length})
          </h2>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 text-lg">No companies found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add your first company to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {companies.map((company) => (
              <CompanyRow
                key={company.slug}
                company={company}
                onUpdate={handleUpdateCompany}
                onDelete={handleDeleteCompany}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CompanyRowProps {
  company: CompanyWithStats
  onUpdate: (
    slug: string,
    updates: {
      name?: string
      website?: string | null
      icon_url?: string | null
    }
  ) => Promise<boolean>
  onDelete: (slug: string) => Promise<void>
}

function CompanyRow({ company, onUpdate, onDelete }: CompanyRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(company.name)
  const [editWebsite, setEditWebsite] = useState(company.website || '')
  const [editIconUrl, setEditIconUrl] = useState(company.icon_url || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onUpdate(company.slug, {
      name: editName,
      website: editWebsite || null,
      icon_url: editIconUrl || null,
    })
    if (success) {
      setIsEditing(false)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName(company.name)
    setEditWebsite(company.website || '')
    setEditIconUrl(company.icon_url || '')
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    await onDelete(company.slug)
    setIsDeleting(false)
  }

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-white/5">
      {/* Icon */}
      <div className="shrink-0">
        {isEditing ? (
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
            {editIconUrl ? (
              <CompanyIcon
                iconUrl={editIconUrl}
                companyName={editName}
                size="md"
              />
            ) : (
              <span className="text-gray-500 text-xs">No icon</span>
            )}
          </div>
        ) : (
          <CompanyIcon
            iconUrl={company.icon_url}
            companyName={company.name}
            size="md"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Company name"
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="url"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="Website URL"
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
              />
              <input
                type="url"
                value={editIconUrl}
                onChange={(e) => setEditIconUrl(e.target.value)}
                placeholder="Icon URL"
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/20 text-white text-sm"
              />
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-medium text-white">{company.name}</h3>
            <p className="text-sm text-gray-400">
              {company.slug}
              {company.website && (
                <>
                  {' • '}
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    website
                  </a>
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="text-center px-4">
        <div className="text-lg font-semibold text-white">
          {company.band_count}
        </div>
        <div className="text-xs text-gray-400">bands</div>
      </div>

      <div className="text-center px-4">
        <div className="text-lg font-semibold text-white">
          {company.event_count}
        </div>
        <div className="text-xs text-gray-400">events</div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 bg-success/20 hover:bg-success/30 text-success rounded-lg transition-colors disabled:opacity-50"
              title="Save"
            >
              {isSaving ? <VinylSpinner size="xxs" /> : <CheckIcon size={18} />}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Cancel"
            >
              <CloseIcon size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
              title="Edit"
            >
              <EditIcon size={18} />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || company.band_count > 0}
              className="p-2 hover:bg-error/20 text-gray-400 hover:text-error rounded-lg transition-colors disabled:opacity-50"
              title={
                company.band_count > 0
                  ? 'Cannot delete - company has bands'
                  : 'Delete'
              }
            >
              {isDeleting ? (
                <VinylSpinner size="xxs" />
              ) : (
                <DeleteIcon size={18} />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
