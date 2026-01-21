import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lesson, VocabularyItem } from '../types'

type TranscriptMode = 'hide' | 'show' | 'vietnamese' | 'vocabulary'

type Picked = {
  text: string
  // token indices in the tokenized stream (inclusive)
  start: number
  end: number
  // fixed viewport coordinates (px)
  x: number
  y: number
  isMobile?: boolean
}

interface PlayerScreenProps {
  activeLesson: Lesson
  vocabulary: VocabularyItem[]
}

export default function PlayerScreen({ activeLesson, vocabulary }: PlayerScreenProps) {
  const vocabDisplay = vocabulary.filter((v) => v.sourceLesson === activeLesson.id)
  const duration = activeLesson.audio.duration
  const [currentTime, setCurrentTime] = useState(0)
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('hide')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [translatedVi, setTranslatedVi] = useState<string>('')
  const [isTranslating, setIsTranslating] = useState(false)
  const translateAbortRef = useRef<AbortController | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
  }

  const englishText = useMemo(
    () => activeLesson.english.split('/*/').map((s) => s.trim()).join('\n\n'),
    [activeLesson.english]
  )
  const vietnameseText = useMemo(
    () => activeLesson.vietnamese.split('/*/').map((s) => s.trim()).join('\n\n'),
    [activeLesson.vietnamese]
  )

  const tokenize = (text: string) => {
    // Keep whitespace tokens so selection/highlight looks natural.
    return text.match(/(\s+|[^\s]+)/g) ?? []
  }

  const englishTokens = useMemo(() => tokenize(englishText), [englishText])
  const vietnameseTokens = useMemo(() => tokenize(vietnameseText), [vietnameseText])

  const closePicked = () => {
    setPicked(null)
    setTranslatedVi('')
    setIsTranslating(false)
    translateAbortRef.current?.abort()
    translateAbortRef.current = null
  }

  const playPicked = () => {
    if (!picked?.text?.trim()) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(picked.text)
    // Try to pick an English voice if available
    const voices = window.speechSynthesis.getVoices()
    const enVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('en'))
    if (enVoice) utter.voice = enVoice
    utter.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  // Keep popover anchored to the picked token on scroll/resize
  useEffect(() => {
    if (!picked || transcriptMode !== 'show') return

    const popoverWidth = Math.min(260, window.innerWidth - 24)
    const popoverHeight = 200 // Estimated height
    
    const findTokenElement = (): HTMLElement | null => {
      // Try to find the first token in the selection range
      const startEl = document.querySelector(`[data-token-idx="${picked.start}"]`) as HTMLElement | null
      if (startEl) return startEl
      
      // If start not found, try end
      const endEl = document.querySelector(`[data-token-idx="${picked.end}"]`) as HTMLElement | null
      if (endEl) return endEl
      
      // If still not found, try any token in range
      for (let i = picked.start; i <= picked.end; i++) {
        const el = document.querySelector(`[data-token-idx="${i}"]`) as HTMLElement | null
        if (el) return el
      }
      
      return null
    }
    
    const updatePosition = () => {
      const isMobile = window.innerWidth <= 1100
      
      // Find token element (works for both mobile and desktop)
      const el = findTokenElement()
      if (!el) return
      
      const rect = el.getBoundingClientRect()
      
      // Check if element is actually visible
      if (rect.width === 0 && rect.height === 0) return
      
      let newX: number
      let newY: number
      
      if (isMobile) {
        // Mobile: center horizontally, right below picked token
        newX = (window.innerWidth - popoverWidth) / 2
        newX = Math.max(12, Math.min(newX, window.innerWidth - popoverWidth - 12))
        
        // Place right below the token
        newY = rect.bottom + 10
        
        // Clamp Y to viewport
        newY = Math.max(12, Math.min(newY, window.innerHeight - popoverHeight - 12))
      } else {
        // Desktop: align left edge or slightly offset, but keep close
        const maxOffset = 100 // Max distance from token left edge
        const preferredX = rect.left
        const centeredX = rect.left + rect.width / 2 - popoverWidth / 2
        
        // Use whichever is closer to token
        if (Math.abs(centeredX - preferredX) < maxOffset) {
          newX = centeredX
        } else {
          newX = preferredX
        }
        
        newX = Math.max(12, Math.min(newX, window.innerWidth - popoverWidth - 12))
        
        // Calculate Y: try below first, then above if not enough space
        const spaceBelow = window.innerHeight - rect.bottom - 10
        const spaceAbove = rect.top - 10
        
        if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
          // Place below
          newY = rect.bottom + 10
        } else {
          // Place above
          newY = rect.top - popoverHeight - 10
        }
        
        // Clamp Y to viewport, but keep it close to token
        newY = Math.max(12, Math.min(newY, window.innerHeight - popoverHeight - 12))
      }
      
      setPicked((prev) => {
        if (!prev) return prev
        // On mobile, use larger threshold to avoid jitter
        const threshold = isMobile ? 2 : 0.5
        if (Math.abs(prev.x - newX) < threshold && Math.abs(prev.y - newY) < threshold) return prev
        return { ...prev, x: newX, y: newY, isMobile }
      })
    }

    // Use throttled update strategy, especially for mobile to avoid jitter
    let rafId: number | null = null
    let lastUpdateTime = 0
    const MOBILE_THROTTLE_MS = 100 // Throttle updates on mobile to 100ms
    const DESKTOP_THROTTLE_MS = 50
    
    const scheduleUpdate = () => {
      const now = Date.now()
      const throttleMs = window.innerWidth <= 1100 ? MOBILE_THROTTLE_MS : DESKTOP_THROTTLE_MS
      
      if (rafId !== null) return
      if (now - lastUpdateTime < throttleMs) {
        // Schedule for later
        rafId = requestAnimationFrame(() => {
          const elapsed = Date.now() - lastUpdateTime
          if (elapsed >= throttleMs) {
            updatePosition()
            lastUpdateTime = Date.now()
          }
          rafId = null
        })
        return
      }
      
      rafId = requestAnimationFrame(() => {
        updatePosition()
        lastUpdateTime = Date.now()
        rafId = null
      })
    }

    const onScrollOrResize = () => {
      scheduleUpdate()
    }

    // Also listen to mutations in case DOM structure changes
    const observer = new MutationObserver(() => {
      scheduleUpdate()
    })

    // Observe the transcript container for changes
    const transcriptContainer = document.querySelector('.transcript-selectable')
    if (transcriptContainer) {
      observer.observe(transcriptContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })
    }

    updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    
    // Also update on orientation change (mobile)
    window.addEventListener('orientationchange', () => {
      setTimeout(updatePosition, 100)
    })
    
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('orientationchange', () => {
        setTimeout(updatePosition, 100)
      })
      observer.disconnect()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [picked, transcriptMode])

  const extractTokenIndex = (node: Node | null): number | null => {
    if (!node) return null
    // Selection anchor/focus can be a Text node inside our <span>
    const el =
      node instanceof HTMLElement
        ? node
        : node.parentElement instanceof HTMLElement
          ? node.parentElement
          : null
    const span = el?.closest?.('[data-token-idx]') as HTMLElement | null
    if (!span) return null
    const raw = span.getAttribute('data-token-idx')
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  const onTranscriptMouseUp = () => {
    if (transcriptMode !== 'show') return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return

    const text = sel.toString().trim()
    if (!text) return

    const startIdx = extractTokenIndex(sel.anchorNode)
    const endIdx = extractTokenIndex(sel.focusNode)
    if (startIdx == null || endIdx == null) return

    const a = Math.min(startIdx, endIdx)
    const b = Math.max(startIdx, endIdx)
    const joined = englishTokens.slice(a, b + 1).join('').trim()
    if (!joined) return

    const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    if (!rect) return

    const popoverWidth = Math.min(260, window.innerWidth - 24)
    const popoverHeight = 200
    const tokenCenterX = rect.left + rect.width / 2
    let x = tokenCenterX - popoverWidth / 2
    x = Math.max(12, Math.min(x, window.innerWidth - popoverWidth - 12))
    
    const spaceBelow = window.innerHeight - rect.bottom - 10
    const spaceAbove = rect.top - 10
    let y: number
    if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
      y = rect.bottom + 10
    } else {
      y = rect.top - popoverHeight - 10
    }
    y = Math.max(12, Math.min(y, window.innerHeight - popoverHeight - 12))

    const isMobile = window.innerWidth <= 1100
    setPicked({ text: joined, start: a, end: b, x, y, isMobile })
  }

  const onTokenClick = (idx: number) => {
    if (transcriptMode !== 'show') return
    const token = englishTokens[idx] ?? ''
    const text = token.trim()
    if (!text) return
    // Put popover near the clicked token
    const el = document.querySelector(`[data-token-idx="${idx}"]`)
    const rect = el instanceof HTMLElement ? el.getBoundingClientRect() : null
    if (!rect) {
      const isMobile = window.innerWidth <= 1100
    setPicked({ text, start: idx, end: idx, x: 24, y: 120, isMobile })
      return
    }
    
    const popoverWidth = Math.min(260, window.innerWidth - 24)
    const popoverHeight = 200
    const tokenCenterX = rect.left + rect.width / 2
    let x = tokenCenterX - popoverWidth / 2
    x = Math.max(12, Math.min(x, window.innerWidth - popoverWidth - 12))
    
    const spaceBelow = window.innerHeight - rect.bottom - 10
    const spaceAbove = rect.top - 10
    let y: number
    if (spaceBelow >= popoverHeight || spaceBelow >= spaceAbove) {
      y = rect.bottom + 10
    } else {
      y = rect.top - popoverHeight - 10
    }
    y = Math.max(12, Math.min(y, window.innerHeight - popoverHeight - 12))
    
    const isMobile = window.innerWidth <= 1100
    setPicked({ text, start: idx, end: idx, x, y, isMobile })
  }

  useEffect(() => {
    // Only translate when picking on English transcript.
    if (!picked || transcriptMode !== 'show') return

    // Abort previous translation if any
    translateAbortRef.current?.abort()
    const controller = new AbortController()
    translateAbortRef.current = controller

    setIsTranslating(true)
    setTranslatedVi('')

    const q = picked.text.trim()
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(q)}`

    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        // data[0] is an array of [translated, original, ...]
        const translated = Array.isArray(data?.[0])
          ? data[0].map((part: any) => (Array.isArray(part) ? part[0] : '')).join('')
          : ''
        setTranslatedVi(translated || 'Không dịch được (offline hoặc bị chặn).')
      })
      .catch(() => {
        setTranslatedVi('Không dịch được (offline hoặc bị chặn).')
      })
      .finally(() => {
        setIsTranslating(false)
      })

    return () => controller.abort()
  }, [picked, transcriptMode])

  return (
    <main className="resin-stage player-stage">
      <section className="side-panel player-side">
        <span className="label-mono">Module 01 // Basics</span>
        <h1>
          Daily
          <br />
          Listening
        </h1>

        <div className="lesson-card">
          <span className="label-mono" style={{ color: 'var(--gold)' }}>
            Current Track
          </span>
          <p className="lesson-title">{activeLesson.content}</p>
          <div className="difficulty-indicator">
            <div className="dot active" />
            <div className="dot" />
            <div className="dot" />
            <span className="label-mono difficulty-label">Beginner</span>
          </div>
        </div>
      </section>

      <section className="center-player player-center-fixed">
        <div className="orb-container">
          <div className="progress-ring" />
          <div className="resin-orb">
            <div className="play-icon" />
          </div>
        </div>

        <div className="controls">
          <button className="btn-control">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <div className="wave-animation">
            <div className="bar" style={{ animationDelay: '0.1s' }} />
            <div className="bar" style={{ animationDelay: '0.3s' }} />
            <div className="bar" style={{ animationDelay: '0.2s' }} />
            <div className="bar" style={{ animationDelay: '0.4s' }} />
            <div className="bar" style={{ animationDelay: '0.1s' }} />
          </div>
          <button className="btn-control">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div className="audio-timeline">
          <div className="timeline-container">
            <input
              type="range"
              className="timeline-slider"
              min="0"
              max={duration}
              value={currentTime}
              step="0.1"
              onChange={handleSeek}
            />
            <div className="timeline-progress" style={{ width: `${(currentTime / duration) * 100}%` }} />
          </div>
          <div className="timeline-labels">
            <span className="time-label">{formatTime(currentTime)}</span>
            <span className="time-label">{formatTime(duration)}</span>
          </div>
        </div>
      </section>

      <section className="transcript-column player-transcript">
        <div className="transcript-card">
          <div className="transcript-header">
            <span className="label-mono">Real-time Transcript</span>
            <div className="transcript-modes">
              <button
                className={`mode-btn ${transcriptMode === 'hide' ? 'active' : ''}`}
                onClick={() => setTranscriptMode('hide')}
                title="Hide"
              >
                Hide
              </button>
              <button
                className={`mode-btn ${transcriptMode === 'show' ? 'active' : ''}`}
                onClick={() => setTranscriptMode('show')}
                title="Show English"
              >
                Show
              </button>
              <button
                className={`mode-btn ${transcriptMode === 'vietnamese' ? 'active' : ''}`}
                onClick={() => setTranscriptMode('vietnamese')}
                title="Vietnamese"
              >
                VI
              </button>
              <button
                className={`mode-btn ${transcriptMode === 'vocabulary' ? 'active' : ''}`}
                onClick={() => setTranscriptMode('vocabulary')}
                title="Vocabulary"
              >
                Vocab
              </button>
            </div>
          </div>

          {transcriptMode === 'hide' && (
            <div className="data-stream" style={{ opacity: 0.3, textAlign: 'center', padding: '2rem 0' }}>
              <p>Transcript is hidden</p>
            </div>
          )}

          {transcriptMode === 'show' && (
            <div className="data-stream transcript-selectable" onMouseUp={onTranscriptMouseUp}>
              {englishTokens.map((t, idx) => {
                const isPicked = picked ? idx >= picked.start && idx <= picked.end : false
                return (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    data-token-idx={idx}
                    className={isPicked ? 'picked-token' : undefined}
                    onClick={() => onTokenClick(idx)}
                  >
                    {t}
                  </span>
                )
              })}
            </div>
          )}

          {transcriptMode === 'vietnamese' && (
            <div className="data-stream transcript-selectable">
              {vietnameseTokens.map((t, idx) => (
                // eslint-disable-next-line react/no-array-index-key
                <span key={idx}>{t}</span>
              ))}
            </div>
          )}

          {transcriptMode === 'vocabulary' && (
            <div style={{ marginTop: '1rem' }}>
              <div className="vocab-chips">
                {vocabDisplay.map((v) => (
                  <div key={v.id} className="vocab-item">
                    <span className="vocab-word">{v.en}</span>
                    <span className="vocab-meaning">{v.vi}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {picked && transcriptMode === 'show' &&
            createPortal(
              <div
                className={`translate-popover ${picked.isMobile ? 'mobile-anchored' : ''}`}
                style={{ left: picked.x, top: picked.y }}
              >
                <div className="translate-popover-head">
                  <span className="label-mono">Picked</span>
                  <button className="popover-close" onClick={closePicked} aria-label="Close">
                    ×
                  </button>
                </div>
                <div className="translate-picked-row">
                  <div className="translate-picked-text">{picked.text}</div>
                  <button className="icon-btn" onClick={playPicked} title="Play pronunciation">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.06v8.12A4.5 4.5 0 0016.5 12zm-2.5-8v2.05a6.5 6.5 0 010 11.9V20a8.5 8.5 0 000-16z" />
                    </svg>
                  </button>
                </div>
                <div className="translate-result">
                  <span className="label-mono">VI</span>
                  <div className="translate-result-text">{isTranslating ? 'Translating…' : translatedVi}</div>
                </div>
                <div className="translate-actions">
                  <button className="mode-btn" disabled title="UI only (coming soon)">
                    Add to vocabulary
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      </section>
    </main>
  )
}

