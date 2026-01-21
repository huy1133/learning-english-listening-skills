import type { Lesson } from '../types'

interface LessonsScreenProps {
  lessons: Lesson[]
  activeLessonId: string
  onSelectLesson: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  onAddLessonClick: () => void
  page: number
  onPageChange: (page: number) => void
  pageSize: number
}

export default function LessonsScreen({
  lessons,
  activeLessonId,
  onSelectLesson,
  search,
  onSearchChange,
  onAddLessonClick,
  page,
  onPageChange,
  pageSize,
}: LessonsScreenProps) {
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
                  onSearchChange(e.target.value)
                  onPageChange(1)
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
                  <div className="dot active" />
                  <div className="dot" />
                  <div className="dot" />
                  <span className="label-mono difficulty-label">
                    {Math.round(l.audio.duration)}s · {l.english.split('/*/').length} segments
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="pagination">
            <button
              className="btn-secondary btn-small"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span className="pagination-label">
              Page {safePage} / {totalPages} · {filteredLessons.length} lessons
            </span>
            <button
              className="btn-secondary btn-small"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
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

