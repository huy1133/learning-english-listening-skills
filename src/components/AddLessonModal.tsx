interface AddLessonModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddLessonModal({ isOpen, onClose }: AddLessonModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="label-mono">Import</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h2 className="modal-title">Add lesson</h2>
        <p className="modal-subtitle">UI only for now. We'll wire upload/parse later.</p>

        <div className="modal-body">
          <label className="file-field">
            <span className="label-mono">lesson.json</span>
            <input className="input" type="file" accept="application/json,.json" />
          </label>

          <label className="file-field">
            <span className="label-mono">audio</span>
            <input className="input" type="file" accept="audio/*" />
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled>
            Save (coming soon)
          </button>
        </div>
      </div>
    </div>
  )
}

