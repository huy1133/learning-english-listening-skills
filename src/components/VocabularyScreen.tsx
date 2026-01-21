import { useMemo, useState } from 'react'
import type { VocabularyItem } from '../types'

interface VocabularyScreenProps {
  vocabulary: VocabularyItem[]
}

export default function VocabularyScreen({ vocabulary }: VocabularyScreenProps) {
  const [search, setSearch] = useState('')
  const [filterLesson, setFilterLesson] = useState<string>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 12

  const lessonOptions = useMemo(() => {
    const ids = new Set(vocabulary.map((v) => v.sourceLesson))
    ids.add('other')
    return Array.from(ids).sort()
  }, [vocabulary])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vocabulary.filter((v) => {
      if (filterLesson !== 'all' && v.sourceLesson !== filterLesson) return false
      if (!q) return true
      return v.en.toLowerCase().includes(q) || v.vi.toLowerCase().includes(q)
    })
  }, [vocabulary, search, filterLesson])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage])

  const goPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages)
    setPage(next)
  }

  return (
    <main className="resin-stage lessons-layout">
      <section className="lessons-shell">
        <div className="lessons-top">
          <div className="actions-stack">
            <label className="search">
              <span className="label-mono">Search</span>
              <input
                className="input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search vocabulary..."
              />
            </label>

            <label className="search" style={{ maxWidth: 240 }}>
              <span className="label-mono">Lesson</span>
              <select
                className="input"
                value={filterLesson}
                onChange={(e) => {
                  setFilterLesson(e.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All lessons</option>
                {lessonOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn-primary btn-small" onClick={() => setIsAddOpen(true)}>
              Add vocab
            </button>
          </div>
        </div>

        <div className="lesson-scroll vocab-scroll">
          <div className="vocab-grid">
            {paged.map((v) => (
              <div className="lesson-card compact vocab-card" key={v.id}>
                <p className="lesson-title" style={{ fontWeight: 700 }}>
                  {v.en}
                </p>
                <p className="lesson-title" style={{ color: 'var(--gold)' }}>
                  {v.vi}
                </p>
              </div>
            ))}
            {paged.length === 0 && (
              <div className="lesson-card compact" style={{ opacity: 0.6 }}>
                <p className="lesson-title">No vocabulary found.</p>
              </div>
            )}
          </div>
        </div>

        <div className="pagination">
          <button className="btn-secondary btn-small" onClick={() => goPage(currentPage - 1)} disabled={currentPage === 1}>
            Prev
          </button>
          <div className="pagination-label">
            Page {currentPage} / {totalPages} · {filtered.length} vocab
          </div>
          <button
            className="btn-secondary btn-small"
            onClick={() => goPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </section>

      {isAddOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setIsAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="label-mono">Import</span>
              <button className="btn-icon" onClick={() => setIsAddOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <h2 className="modal-title">Add vocabulary</h2>
            <p className="modal-subtitle">UI only. New words auto-group into “other”.</p>

            <div className="modal-body">
              <label className="file-field">
                <span className="label-mono">English</span>
                <input className="input" type="text" placeholder="Enter English term" />
              </label>

              <label className="file-field">
                <span className="label-mono">Vietnamese</span>
                <input className="input" type="text" placeholder="Nhập nghĩa tiếng Việt" />
              </label>

              <label className="file-field">
                <span className="label-mono">Lesson</span>
                <select className="input" value="other" disabled>
                  <option value="other">other (auto)</option>
                </select>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsAddOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled>
                Save (coming soon)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

