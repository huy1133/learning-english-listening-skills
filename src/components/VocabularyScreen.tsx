import { useMemo, useState, useEffect, useRef } from 'react'
import type { VocabularyItem, Lesson } from '../types'
import { addVocabularyToFirebase, deleteVocabularyFromFirebase } from '../services/vocabularyService'

interface VocabularyScreenProps {
  vocabulary: VocabularyItem[],
  onVocabularyAdded?: () => Promise<void>
  lessons: Lesson[]
}

export default function VocabularyScreen({ vocabulary, onVocabularyAdded, lessons }: VocabularyScreenProps) {
  const [search, setSearch] = useState('')
  const [filterLesson, setFilterLesson] = useState<string>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 12
  const [en, setEn] = useState('')
  const [vi, setVi] = useState('')
  const [sourceLesson, setSourceLesson] = useState('other')
  const [isTranslating, setIsTranslating] = useState(false)
  const translateAbortRef = useRef<AbortController | null>(null)
  const userEditedViRef = useRef(false)

  const lessonOptions = useMemo(() => {
    const ids = new Set(lessons.map((l) => [l.id, l.content]))
    ids.add(['other', 'other words'])
    ids.add(['common', 'common words'])
    return Array.from(ids).sort()
  }, [lessons])

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

  // Auto-translate when English text is entered
  useEffect(() => {
    if (!en.trim() || userEditedViRef.current) {
      return
    }

    // Debounce translation
    const timeoutId = setTimeout(() => {
      // Abort previous translation if any
      translateAbortRef.current?.abort()
      const controller = new AbortController()
      translateAbortRef.current = controller

      setIsTranslating(true)

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(en.trim())}`

      fetch(url, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          // Check if request was aborted
          if (controller.signal.aborted) return

          // data[0] is an array of [translated, original, ...]
          const translated = Array.isArray(data?.[0])
            ? data[0].map((part: any) => (Array.isArray(part) ? part[0] : '')).join('')
            : ''
          
          // Only update if user hasn't manually edited Vietnamese field
          if (!userEditedViRef.current && translated) {
            setVi(translated)
          }
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Translation error:', error)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsTranslating(false)
          }
        })
    }, 500) // 500ms debounce

    return () => {
      clearTimeout(timeoutId)
      translateAbortRef.current?.abort()
    }
  }, [en])

  // Reset userEditedViRef when modal opens/closes
  useEffect(() => {
    if (isAddOpen) {
      userEditedViRef.current = false
    } else {
      // Reset when modal closes
      setEn('')
      setVi('')
      setSourceLesson('other')
      userEditedViRef.current = false
    }
  }, [isAddOpen])

  const handleEnChange = (value: string) => {
    setEn(value)
    // Reset userEditedViRef when English changes (user might be typing new word)
    if (!value.trim()) {
      userEditedViRef.current = false
    }
  }

  const handleViChange = (value: string) => {
    setVi(value)
    // Mark that user has manually edited Vietnamese field
    if (value.trim()) {
      userEditedViRef.current = true
    }
  }

  const handleSaveVocabulary = async () => {
    try{
      await addVocabularyToFirebase({
        id: crypto.randomUUID(),
        en: en.trim(),
        vi: vi.trim(),
        sourceLesson: sourceLesson,
      })  
      setVi('')
      setEn('')
      setSourceLesson('other')
      userEditedViRef.current = false
      setIsAddOpen(false)
      if (onVocabularyAdded) {
        await onVocabularyAdded()
      }
    } catch (error) {
      console.error('Error saving vocabulary:', error)
      alert('Failed to save vocabulary. Please try again.')
    }
  }

  const handleDeleteVocabulary = async (vocabId: string) => {
    if (!confirm('Are you sure you want to delete this vocabulary?')) {
      return
    }
    
    try {
      await deleteVocabularyFromFirebase(vocabId)
      if (onVocabularyAdded) {
        await onVocabularyAdded()
      }
    } catch (error) {
      console.error('Error deleting vocabulary:', error)
      alert('Failed to delete vocabulary. Please try again.')
    }
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
                {lessonOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
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
              <div className="lesson-card compact vocab-card vocab-card-with-delete" key={v.id}>
                <button
                  className="vocab-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteVocabulary(v.id)
                  }}
                  aria-label="Delete vocabulary"
                  title="Delete vocabulary"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.5 2V1C5.5 0.447715 5.94772 0 6.5 0H9.5C10.0523 0 10.5 0.447715 10.5 1V2H13.5C13.7761 2 14 2.22386 14 2.5C14 2.77614 13.7761 3 13.5 3H13V13C13 14.1046 12.1046 15 11 15H5C3.89543 15 3 14.1046 3 13V3H2.5C2.22386 3 2 2.77614 2 2.5C2 2.22386 2.22386 2 2.5 2H5.5ZM6.5 1V2H9.5V1H6.5ZM4 3V13C4 13.5523 4.44772 14 5 14H11C11.5523 14 12 13.5523 12 13V3H4Z" fill="currentColor"/>
                    <path d="M6.5 5.5C6.77614 5.5 7 5.72386 7 6V11C7 11.2761 6.77614 11.5 6.5 11.5C6.22386 11.5 6 11.2761 6 11V6C6 5.72386 6.22386 5.5 6.5 5.5Z" fill="currentColor"/>
                    <path d="M9.5 5.5C9.77614 5.5 10 5.72386 10 6V11C10 11.2761 9.77614 11.5 9.5 11.5C9.22386 11.5 9 11.2761 9 11V6C9 5.72386 9.22386 5.5 9.5 5.5Z" fill="currentColor"/>
                  </svg>
                </button>
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
                <input 
                  className="input" 
                  type="text" 
                  placeholder="Enter English term" 
                  value={en} 
                  onChange={(e) => handleEnChange(e.target.value)} 
                />
              </label>

              <label className="file-field">
                <span className="label-mono">Vietnamese</span>
                <input 
                  className="input" 
                  type="text" 
                  placeholder={isTranslating ? 'Translating...' : 'Nhập nghĩa tiếng Việt'} 
                  value={vi} 
                  onChange={(e) => handleViChange(e.target.value)}
                  disabled={isTranslating}
                />
                {isTranslating && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem' }}>
                    Auto-translating...
                  </p>
                )}
              </label>

              <label className="file-field">
                <span className="label-mono">Lesson</span>
                <select 
                  className="input" 
                  value={sourceLesson}
                  onChange={(e) => setSourceLesson(e.target.value)}
                >
                  <option value="other">other (auto)</option>
                  <option value="common">Common words</option>
                </select>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setIsAddOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveVocabulary}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

