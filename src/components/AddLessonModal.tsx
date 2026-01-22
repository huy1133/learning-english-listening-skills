import { useState } from 'react'
import { addLessonToFirebase, uploadAudioToStorage } from '../services/lessonService'

interface AddLessonModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: () => Promise<void>
}

export default function AddLessonModal({ isOpen, onClose, onImportSuccess }: AddLessonModalProps) {
  if (!isOpen) return null

  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [jsonFileName, setJsonFileName] = useState<string>('')
  const [audioFileName, setAudioFileName] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [level, setLevel] = useState<number>(1)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)

  const handleUploadSubmit = async () => {
    setJsonError(null)
    setAudioError(null)
    
    if (!jsonFile) {
      setJsonError('Please select a JSON file')
      return
    }
    if (!audioFile) {
      setAudioError('Please select an audio file')
      return
    }
    const lessonId = crypto.randomUUID()
    setIsUploading(true)
    try {
      const { url, duration, fileName } = await uploadAudioToStorage(audioFile, lessonId)
      const text = await jsonFile.text()
      const data = JSON.parse(text)
      const lesson = {
        ...data,
        id: lessonId,
        uploadedBy: 'admin',
        audio: {
          filename: fileName,
          url: url,
          duration: duration,
        },
        difficulty: level,
        archived: false,
        createdAt: new Date().toISOString(),
      }

      await addLessonToFirebase(lesson)
      
      // Reload lessons from Firebase
      if (onImportSuccess) {
        await onImportSuccess()
      }
      
      // Reset form on success
      setJsonFile(null)
      setAudioFile(null)
      setJsonFileName('')
      setAudioFileName('')
      setJsonError(null)
      setAudioError(null)
      onClose()
    } catch (error) {
      console.error('Error importing lesson:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to import lesson'
      setJsonError(errorMessage)
      // Keep files selected so user can retry
    } finally {
      setIsUploading(false)
    }
  }

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setJsonFile(file)
    setJsonFileName(file?.name ?? '')
    setJsonError(null)
  }

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAudioFile(file)
    setAudioFileName(file?.name ?? '')
    setAudioError(null)
  }

  if (isUploading) {
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <span className="label-mono">Importing...</span>
            <button className="btn-icon" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
      </div>
    )
  }

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
            <input 
              className="input" 
              type="file" 
              accept="application/json,.json" 
              onChange={handleJsonFileChange}
            />
            {jsonFileName && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Selected: {jsonFileName}
              </p>
            )}
            {jsonError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{jsonError}</p>}
          </label>

          <label className="file-field">
            <span className="label-mono">audio</span>
            <input 
              className="input" 
              type="file" 
              accept="audio/*" 
              onChange={handleAudioFileChange}
            />
            {audioFileName && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Selected: {audioFileName}
              </p>
            )}
            {audioError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{audioError}</p>}
          </label>
        </div>

        <div className="modal-body">
          <label className="file-field">
            <span className="label-mono">Level</span>
            <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              <option value="1">Beginner</option>
              <option value="2">Intermediate</option>
              <option value="3">Advanced</option>
            </select>
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleUploadSubmit}>
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

