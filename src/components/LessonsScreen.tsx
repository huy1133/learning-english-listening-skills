import { useState } from 'react'
import { useLessons } from '../hooks/useLessons'

interface LessonsScreenProps {
  activeLessonId: string
  onSelectLesson: (id: string) => void
  onAddLessonClick: () => void
}

export default function LessonsScreen({
  activeLessonId,
  onSelectLesson,
  onAddLessonClick,
}: LessonsScreenProps) {
  const { lessons, loading, error } = useLessons()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const filteredLessons = lessons.filter(
    (l) =>
      !search.trim() ||
      l.content.toLowerCase().includes(search.trim().toLowerCase()) ||
      l.uploadedBy.toLowerCase().includes(search.trim().toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredLessons.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  const pagedLessons = filteredLessons.slice(start, start + pageSize)

  // Show loading state
  if (loading) {
    return (
      <main className="resin-stage lessons-layout">
        <section className="lessons-shell">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '50vh',
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '1rem' }}>Loading lessons...</div>
              {error && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Using fallback data
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    )
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
                placeholder="Search by title or uploader..."
              />
            </label>

            <button className="btn-primary btn-small" onClick={onAddLessonClick}>
              Add lesson
            </button>
          </div>
        </div>

        <div className="lesson-scroll">
          <div className="lesson-list">
            {pagedLessons.map((l) => (
              <button
                key={l.id}
                className={`lesson-card compact ${l.id === activeLessonId ? 'active' : ''}`}
                onClick={() => onSelectLesson(l.id)}
              >
                <span className="label-mono" style={{ color: 'var(--gold)' }}>
                  {l.uploadedBy}
                </span>
                <p className="lesson-title">{l.content}</p>
                <div className="difficulty-indicator" style={{ marginTop: '1rem' }}>
                  <div className={`dot ${l.difficulty >= 1 ? 'active' : ''}`} />
                  <div className={`dot ${l.difficulty >= 2 ? 'active' : ''}`} />
                  <div className={`dot ${l.difficulty >= 3 ? 'active' : ''}`} />
                  <span className="label-mono difficulty-label">
                    {Math.round(l.audio.duration)}s · {l.english.split('/*/').length} segments
                  </span>
                </div>
              </button>
            ))}
            {lessons.length === 0 && (
              <div className="lesson-card compact" style={{ opacity: 0.6 }}>
                <p className="lesson-title">No lessons found.</p>
              </div>
            )}
          </div>

          <div className="pagination">
            <button
              className="btn-secondary btn-small"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span className="pagination-label">
              Page {safePage} / {totalPages} · {filteredLessons.length} lessons
            </span>
            <button
              className="btn-secondary btn-small"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

