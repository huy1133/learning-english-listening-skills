import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lesson, VocabularyItem } from '../types'
import { addVocabularyToFirebase } from '../services/vocabularyService'
import { generateQuestions, evaluateAnswer, type QAQuestion, type QAEvaluation } from '../services/geminiService'

type TranscriptMode = 'hide' | 'show' | 'vietnamese' | 'vocabulary' | 'review' | 'qa'

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
  activeLesson: Lesson | null
  vocabulary: VocabularyItem[]
  onVocabularyAdded?: () => Promise<void>
  shouldAutoPlay?: boolean
  onAutoPlayComplete?: () => void
}

export default function PlayerScreen({ activeLesson, vocabulary, onVocabularyAdded, shouldAutoPlay = false, onAutoPlayComplete }: PlayerScreenProps) {
  const vocabDisplay = activeLesson ? vocabulary.filter((v) => v.sourceLesson === activeLesson.id) : []

  // Shuffle vocabulary for review
  const shuffleVocabulary = (words: VocabularyItem[]): VocabularyItem[] => {
    const shuffled = [...words]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Start review session
  const startReview = () => {
    if (vocabDisplay.length === 0) {
      alert('Không có từ vựng nào để kiểm tra cho bài học này.')
      return
    }
    const shuffled = shuffleVocabulary(vocabDisplay)
    setReviewWords(shuffled)
    setCurrentReviewIndex(0)
    setReviewInput('')
    setReviewFeedback(null)
    setIsReviewOpen(true)
  }

  // Handle review answer submission
  const handleReviewSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!reviewInput.trim() || currentReviewIndex >= reviewWords.length) return

    const currentWord = reviewWords[currentReviewIndex]
    const userAnswer = reviewInput.trim().toLowerCase()
    const correctAnswer = currentWord.en.trim().toLowerCase()

    // Check if answer is correct (allow for minor variations)
    const isCorrect = userAnswer === correctAnswer || 
                     userAnswer === correctAnswer.replace(/[.,!?;:\-—–)\]}\"'"]+$/, '').trim()

    if (isCorrect) {
      setReviewFeedback('correct')
      // Move to next word after a short delay
      setTimeout(() => {
        if (currentReviewIndex + 1 < reviewWords.length) {
          setCurrentReviewIndex(currentReviewIndex + 1)
          setReviewInput('')
          setReviewFeedback(null)
        } else {
          // All words completed
          setIsReviewOpen(false)
          setReviewFeedback(null)
          alert('Chúc mừng! Bạn đã hoàn thành tất cả các từ vựng!')
        }
      }, 1000)
    } else {
      setReviewFeedback('incorrect')
      // Show correct answer and allow retry
      setTimeout(() => {
        setReviewInput('')
        setReviewFeedback(null)
      }, 2000)
    }
  }

  // Close review modal
  const closeReview = () => {
    setIsReviewOpen(false)
    setReviewInput('')
    setReviewFeedback(null)
    setCurrentReviewIndex(0)
    setReviewWords([])
  }

  // Get session storage key for QA questions
  const getQAStorageKey = (lessonId: string) => `qa_questions_${lessonId}`

  // Load QA questions from sessionStorage
  const loadQAFromStorage = (lessonId: string): QAQuestion[] | null => {
    try {
      const stored = sessionStorage.getItem(getQAStorageKey(lessonId))
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Error loading QA from storage:', error)
    }
    return null
  }

  // Save QA questions to sessionStorage
  const saveQAToStorage = (lessonId: string, questions: QAQuestion[]) => {
    try {
      sessionStorage.setItem(getQAStorageKey(lessonId), JSON.stringify(questions))
    } catch (error) {
      console.error('Error saving QA to storage:', error)
    }
  }

  // Start QA session
  const startQA = async (forceRegenerate: boolean = false) => {
    if (!activeLesson || !englishText.trim()) {
      setQaError('No lesson or transcript available')
      return
    }

    setIsQAOpen(true)
    setQaError(null)
    setQaAnswers([])
    setQaEvaluations([])
    setCurrentQaIndex(0)

    // Check if questions exist in sessionStorage
    if (!forceRegenerate) {
      const storedQuestions = loadQAFromStorage(activeLesson.id)
      if (storedQuestions && storedQuestions.length > 0) {
        setQaQuestions(storedQuestions)
        setQaAnswers(new Array(storedQuestions.length).fill(''))
        setQaEvaluations(new Array(storedQuestions.length))
        return
      }
    }

    // Generate new questions
    setIsGeneratingQuestions(true)
    setQaQuestions([])

    try {
      const questions = await generateQuestions(englishText, 4)
      setQaQuestions(questions)
      setQaAnswers(new Array(questions.length).fill(''))
      setQaEvaluations(new Array(questions.length))
      // Save to sessionStorage
      saveQAToStorage(activeLesson.id, questions)
    } catch (error) {
      console.error('Error generating questions:', error)
      setQaError(error instanceof Error ? error.message : 'Failed to generate questions. Please check your API key.')
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  // Generate questions again
  const regenerateQA = async () => {
    await startQA(true)
  }

  // Close QA modal
  const closeQA = () => {
    setIsQAOpen(false)
    setQaQuestions([])
    setQaAnswers([])
    setQaEvaluations([])
    setCurrentQaIndex(0)
    setQaError(null)
  }

  // Handle QA answer submission
  const handleQASubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!activeLesson || currentQaIndex >= qaQuestions.length) return

    const currentAnswer = qaAnswers[currentQaIndex]?.trim() || ''
    if (!currentAnswer) {
      alert('Please enter an answer')
      return
    }

    setIsEvaluatingAnswer(true)
    setQaError(null)

    try {
      const evaluation = await evaluateAnswer(
        qaQuestions[currentQaIndex].question,
        currentAnswer,
        englishText
      )

      const newEvaluations = [...qaEvaluations]
      newEvaluations[currentQaIndex] = evaluation
      setQaEvaluations(newEvaluations)
    } catch (error) {
      console.error('Error evaluating answer:', error)
      setQaError(error instanceof Error ? error.message : 'Failed to evaluate answer')
    } finally {
      setIsEvaluatingAnswer(false)
    }
  }

  // Reset QA session
  const resetQA = () => {
    if (activeLesson) {
      // Clear from sessionStorage
      try {
        sessionStorage.removeItem(getQAStorageKey(activeLesson.id))
      } catch (error) {
        console.error('Error clearing QA from storage:', error)
      }
    }
    setQaQuestions([])
    setQaAnswers([])
    setQaEvaluations([])
    setCurrentQaIndex(0)
    setQaError(null)
    setIsGeneratingQuestions(false)
    setIsEvaluatingAnswer(false)
  }

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>('hide')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [translatedVi, setTranslatedVi] = useState<string>('')
  const [isAddingVocabulary, setIsAddingVocabulary] = useState(false)
  const [seekIndicator, setSeekIndicator] = useState<string | null>(null)
  const [seekIndicatorKey, setSeekIndicatorKey] = useState(0)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [reviewWords, setReviewWords] = useState<VocabularyItem[]>([])
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [reviewInput, setReviewInput] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<'correct' | 'incorrect' | null>(null)
  // QA state
  const [isQAOpen, setIsQAOpen] = useState(false)
  const [qaQuestions, setQaQuestions] = useState<QAQuestion[]>([])
  const [currentQaIndex, setCurrentQaIndex] = useState(0)
  const [qaAnswers, setQaAnswers] = useState<string[]>([])
  const [qaEvaluations, setQaEvaluations] = useState<QAEvaluation[]>([])
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)
  const translateAbortRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousLessonIdRef = useRef<string | null>(null)
  const seekIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reviewInputRef = useRef<HTMLInputElement | null>(null)
  const qaInputRef = useRef<HTMLTextAreaElement | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Remove trailing punctuation from picked text
  const removeTrailingPunctuation = (text: string): string => {
    // Remove common punctuation marks at the end: . , ! ? ; : - — – ) ] } " ' 
    return text.replace(/[.,!?;:\-—–)\]}\"'"]+$/, '').trim()
  }

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      })
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration || 0)
        }
      })
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
      audioRef.current.addEventListener('play', () => setIsPlaying(true))
      audioRef.current.addEventListener('pause', () => setIsPlaying(false))
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Load audio when lesson changes (but don't auto-play)
  useEffect(() => {
    if (!activeLesson || !audioRef.current) return

    const lessonId = activeLesson.id
    const audioUrl = activeLesson.audio.url
    
    // Only load if this is a new lesson
    const isNewLesson = previousLessonIdRef.current !== lessonId
    
    if (isNewLesson) {
      previousLessonIdRef.current = lessonId
      
      // Pause current audio if playing
      if (!audioRef.current.paused) {
        audioRef.current.pause()
      }
      
      // Load new audio
      audioRef.current.src = audioUrl
      audioRef.current.load()
      setCurrentTime(0)
      setIsPlaying(false)
      
      // Set duration from lesson data as fallback
      if (activeLesson.audio.duration) {
        setDuration(activeLesson.audio.duration)
      }
    } else {
      // Same lesson, just update duration if needed
      if (activeLesson.audio.duration && duration !== activeLesson.audio.duration) {
        setDuration(activeLesson.audio.duration)
      }
    }
  }, [activeLesson?.id, activeLesson?.audio.url, duration])

  // Auto-play only when shouldAutoPlay is true and lesson is loaded
  useEffect(() => {
    if (!shouldAutoPlay || !activeLesson || !audioRef.current) return
    
    // Only auto-play if audio is ready
    const playAudio = () => {
      if (audioRef.current && !audioRef.current.paused) {
        // Already playing, don't restart
        if (onAutoPlayComplete) {
          onAutoPlayComplete()
        }
        return
      }
      
      if (audioRef.current) {
        audioRef.current.play().catch((error) => {
          // Ignore AbortError (interrupted play requests)
          if (error.name !== 'AbortError') {
            console.error('Error playing audio:', error)
          }
          setIsPlaying(false)
        })
        // Reset shouldAutoPlay after starting to play
        if (onAutoPlayComplete) {
          onAutoPlayComplete()
        }
      }
    }
    
    // Try to play when audio is ready
    if (audioRef.current.readyState >= 2) {
      // Audio already loaded
      playAudio()
    } else {
      // Wait for audio to load
      const onCanPlay = () => {
        playAudio()
        audioRef.current?.removeEventListener('canplay', onCanPlay)
      }
      audioRef.current.addEventListener('canplay', onCanPlay)
      
      // Cleanup listener
      return () => {
        audioRef.current?.removeEventListener('canplay', onCanPlay)
      }
    }
  }, [shouldAutoPlay, activeLesson?.id, activeLesson?.audio.url, onAutoPlayComplete])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handlePlayPause = () => {
    if (!audioRef.current || !activeLesson) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((error) => {
        // Ignore AbortError (interrupted play requests)
        if (error.name !== 'AbortError') {
          console.error('Error playing audio:', error)
        }
        setIsPlaying(false)
      })
    }
  }

  const handleRewind = () => {
    if (!audioRef.current || !activeLesson) return
    
    const newTime = Math.max(0, audioRef.current.currentTime - 5)
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
    
    // Clear existing timeout
    if (seekIndicatorTimeoutRef.current) {
      clearTimeout(seekIndicatorTimeoutRef.current)
    }
    
    // Reset indicator to trigger animation again
    setSeekIndicator(null)
    setSeekIndicatorKey(prev => prev + 1)
    
    // Use setTimeout to set indicator after reset, ensuring animation restarts
    setTimeout(() => {
      setSeekIndicator('-5s')
      seekIndicatorTimeoutRef.current = setTimeout(() => {
        setSeekIndicator(null)
      }, 1000)
    }, 10)
  }

  const handleForward = () => {
    if (!audioRef.current || !activeLesson) return
    
    const newTime = Math.min(duration, audioRef.current.currentTime + 5)
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
    
    // Clear existing timeout
    if (seekIndicatorTimeoutRef.current) {
      clearTimeout(seekIndicatorTimeoutRef.current)
    }
    
    // Reset indicator to trigger animation again
    setSeekIndicator(null)
    setSeekIndicatorKey(prev => prev + 1)
    
    // Use setTimeout to set indicator after reset, ensuring animation restarts
    setTimeout(() => {
      setSeekIndicator('+5s')
      seekIndicatorTimeoutRef.current = setTimeout(() => {
        setSeekIndicator(null)
      }, 1000)
    }, 10)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (seekIndicatorTimeoutRef.current) {
        clearTimeout(seekIndicatorTimeoutRef.current)
      }
    }
  }, [])

  const englishText = useMemo(
    () => activeLesson?.english.split('/*/').map((s) => s.trim()).join('\n\n') ?? '',
    [activeLesson?.english]
  )
  const vietnameseText = useMemo(
    () => activeLesson?.vietnamese.split('/*/').map((s) => s.trim()).join('\n\n') ?? '',
    [activeLesson?.vietnamese]
  )

  const tokenize = (text: string) => {
    // Keep whitespace tokens so selection/highlight looks natural.
    return text.match(/(\s+|[^\s]+)/g) ?? []
  }

  const englishTokens = useMemo(() => tokenize(englishText), [englishText])
  const vietnameseTokens = useMemo(() => tokenize(vietnameseText), [vietnameseText])

  // Check if picked word is already in vocabulary
  const isPickedWordInVocabulary = useMemo(() => {
    if (!picked || !activeLesson) return false
    const pickedText = picked.text.trim().toLowerCase()
    return vocabulary.some(
      (v) =>
        v.en.trim().toLowerCase() === pickedText &&
        v.sourceLesson === activeLesson.id
    )
  }, [picked, vocabulary, activeLesson])

  const closePicked = () => {
    setPicked(null)
    setTranslatedVi('')
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
    const joined = removeTrailingPunctuation(englishTokens.slice(a, b + 1).join('').trim())
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
    const text = removeTrailingPunctuation(token.trim())
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

    return () => controller.abort()
  }, [picked, transcriptMode])

  // Auto-focus review input when modal opens or word changes
  useEffect(() => {
    if (isReviewOpen && reviewWords.length > 0 && currentReviewIndex < reviewWords.length && reviewFeedback === null) {
      // Use requestAnimationFrame to ensure DOM is ready
      const focusInput = () => {
        if (reviewInputRef.current) {
          reviewInputRef.current.focus()
        }
      }
      // Try multiple times to ensure focus works
      requestAnimationFrame(() => {
        focusInput()
        setTimeout(focusInput, 50)
        setTimeout(focusInput, 150)
      })
    }
  }, [isReviewOpen, currentReviewIndex, reviewWords.length, reviewFeedback])

  // Auto-focus QA input when modal opens or question changes
  useEffect(() => {
    if (isQAOpen && qaQuestions.length > 0 && currentQaIndex < qaQuestions.length && !qaEvaluations[currentQaIndex]) {
      const focusInput = () => {
        if (qaInputRef.current) {
          qaInputRef.current.focus()
        }
      }
      requestAnimationFrame(() => {
        focusInput()
        setTimeout(focusInput, 50)
        setTimeout(focusInput, 150)
      })
    }
  }, [isQAOpen, currentQaIndex, qaQuestions.length, qaEvaluations])

  const handleAddToVocabulary = async () => {
    if (!picked || !activeLesson || !translatedVi.trim() || isPickedWordInVocabulary) {
      return
    }
    
    setIsAddingVocabulary(true)
    try {
      await addVocabularyToFirebase({
        id: crypto.randomUUID(),
        en: picked.text.trim(),
        vi: translatedVi.trim(),
        sourceLesson: activeLesson.id,
      })
      
      // Reload vocabulary if callback provided
      if (onVocabularyAdded) {
        await onVocabularyAdded()
      }
      
      // Don't close popup, just update state - the button will change to "Added"
    } catch (error) {
      console.error('Error adding vocabulary:', error)
      alert('Failed to add vocabulary. Please try again.')
    } finally {
      setIsAddingVocabulary(false)
    }
  }

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
          <p className="lesson-title">{activeLesson?.content ?? 'No lesson selected'}</p>
          <div className="difficulty-indicator">
            <div className={`dot ${activeLesson?.difficulty && activeLesson.difficulty >= 1 ? 'active' : ''}`} />
            <div className={`dot ${activeLesson?.difficulty && activeLesson.difficulty >= 2 ? 'active' : ''}`} />
            <div className={`dot ${activeLesson?.difficulty && activeLesson.difficulty >= 3 ? 'active' : ''}`} />
            <span className="label-mono difficulty-label">
              {activeLesson?.difficulty === 1 ? 'Beginner' : 
              activeLesson?.difficulty === 2 ? 'Intermediate' : 
              activeLesson?.difficulty === 3 ? 'Advanced' : '--'}
            </span>
          </div>
        </div>
      </section>

      <section className="center-player player-center-fixed">
        <div className="orb-container" onClick={handlePlayPause} style={{ cursor: activeLesson ? 'pointer' : 'default' }}>
          <div className="progress-ring" />
          <div className="resin-orb">
            {isPlaying ? (
              <div className="pause-icon">
                <div className="pause-bar" />
                <div className="pause-bar" />
              </div>
            ) : (
              <div className="play-icon" />
            )}
          </div>
        </div>

        <div className="controls">
          <button className="btn-control" onClick={handleRewind} disabled={!activeLesson} title="Rewind 5s">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
          </button>
          <div className="wave-animation" style={{ opacity: isPlaying ? 1 : 0.5 }}>
            <div className="bar" style={{ animationDelay: '0.1s' }} />
            <div className="bar" style={{ animationDelay: '0.3s' }} />
            <div className="bar" style={{ animationDelay: '0.2s' }} />
            <div className="bar" style={{ animationDelay: '0.4s' }} />
            <div className="bar" style={{ animationDelay: '0.1s' }} />
          </div>
          <button className="btn-control" onClick={handleForward} disabled={!activeLesson} title="Forward 5s">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
            </svg>
          </button>
        </div>
        
        {seekIndicator && (
          <div key={seekIndicatorKey} className="seek-indicator">
            {seekIndicator}
          </div>
        )}

        <div className="audio-timeline">
          <div className="timeline-container">
            <input
              type="range"
              className="timeline-slider"
              min="0"
              max={duration || 0}
              value={currentTime}
              step="0.1"
              onChange={handleSeek}
              disabled={!activeLesson || duration === 0}
            />
            <div className="timeline-progress" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
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
              <button
                className={`mode-btn ${transcriptMode === 'review' ? 'active' : ''}`}
                onClick={() => {
                  setTranscriptMode('review')
                  startReview()
                }}
                title="Kiểm tra bài cũ"
                disabled={vocabDisplay.length === 0}
              >
                Review
              </button>
              <button
                className={`mode-btn ${transcriptMode === 'qa' ? 'active' : ''}`}
                onClick={() => {
                  setTranscriptMode('qa')
                  startQA(false)
                }}
                title="Question & Answer"
                disabled={!activeLesson || !englishText.trim()}
              >
                QA
              </button>
            </div>
          </div>

          {!activeLesson ? (
            <div className="data-stream" style={{ opacity: 0.5, textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ marginBottom: '1rem' }}>No lesson selected</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Please select a lesson from the Lessons tab
              </p>
            </div>
          ) : (
            <>
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
                    {vocabDisplay.length > 0 ? (
                      vocabDisplay.map((v) => (
                        <div key={v.id} className="vocab-item">
                          <span className="vocab-word">{v.en}</span>
                          <span className="vocab-meaning">{v.vi}</span>
                        </div>
                      ))
                    ) : (
                      <p style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0' }}>
                        No vocabulary for this lesson
                      </p>
                    )}
                  </div>
                </div>
              )}

              {transcriptMode === 'review' && (
                <div className="data-stream" style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0' }}>
                  <p>Review mode</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {vocabDisplay.length > 0 
                      ? `There are ${vocabDisplay.length} words to review. Click the Review button to start.`
                      : 'There are no words to review for this lesson.'}
                  </p>
                </div>
              )}

              {transcriptMode === 'qa' && (
                <div className="data-stream" style={{ opacity: 0.5, textAlign: 'center', padding: '2rem 0' }}>
                  <p>Question & Answer Mode</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Click the QA button to start the question session
                  </p>
                </div>
              )}
            </>
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
                  <input className="input" type="text" value={picked.text} onChange={(e) => setPicked({ ...picked, text: e.target.value })} />
                  {/*<div className="translate-picked-text">{picked.text}</div>*/}
                  <button className="icon-btn" onClick={playPicked} title="Play pronunciation">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4.06v8.12A4.5 4.5 0 0016.5 12zm-2.5-8v2.05a6.5 6.5 0 010 11.9V20a8.5 8.5 0 000-16z" />
                    </svg>
                  </button>
                </div>
                <div className="translate-result">
                  <span className="label-mono">VI</span>
                  <input className="input" type="text" value={translatedVi} onChange={(e) => setTranslatedVi(e.target.value)} />
                  {/*<div className="translate-result-text">{isTranslating ? 'Translating…' : translatedVi}</div>*/}
                </div>
                 <div className="translate-actions">
                   <button 
                     className={`mode-btn ${isPickedWordInVocabulary ? 'active' : ''}`}
                     onClick={handleAddToVocabulary}
                     disabled={isAddingVocabulary || !translatedVi.trim() || isPickedWordInVocabulary}
                   >
                     {isAddingVocabulary 
                       ? 'Adding...' 
                       : isPickedWordInVocabulary 
                         ? 'Added' 
                         : 'Add to vocabulary'}
                   </button>
                 </div>
              </div>,
              document.body
            )}

          {/* Review Modal */}
          {isReviewOpen && reviewWords.length > 0 && currentReviewIndex < reviewWords.length &&
            createPortal(
              <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeReview}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                  <div className="modal-header">
                    <span className="label-mono">review vocabulary</span>
                    <button className="btn-icon" onClick={closeReview} aria-label="Close">
                      ✕
                    </button>
                  </div>

                  <div className="modal-body">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Word {currentReviewIndex + 1} / {reviewWords.length}
                      </p>
                      <div style={{ 
                        width: '100%', 
                        height: '4px', 
                        backgroundColor: 'var(--bg-secondary)', 
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ 
                          width: `${((currentReviewIndex + 1) / reviewWords.length) * 100}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--accent)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      marginBottom: '1.5rem'
                    }}>
                      <p style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 600,
                        color: 'var(--gold)',
                        marginBottom: '0.5rem'
                      }}>
                        {reviewWords[currentReviewIndex].vi}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Enter the English word corresponding to the word above
                      </p>
                    </div>

                    <form onSubmit={handleReviewSubmit}>
                      <label className="file-field">
                        <span className="label-mono">English</span>
                        <input
                          ref={reviewInputRef}
                          className="input"
                          type="text"
                          value={reviewInput}
                          onChange={(e) => {
                            setReviewInput(e.target.value)
                            setReviewFeedback(null)
                          }}
                          placeholder="Enter the English word..."
                          autoFocus
                          disabled={reviewFeedback !== null}
                        />
                      </label>

                      {reviewFeedback === 'correct' && (
                        <div style={{ 
                          padding: '0.75rem', 
                          backgroundColor: 'rgba(76, 175, 80, 0.1)', 
                          border: '1px solid rgba(76, 175, 80, 0.3)',
                          borderRadius: '4px',
                          marginTop: '1rem',
                          textAlign: 'center',
                          color: '#4caf50'
                        }}>
                          ✓ Correct! Move to the next word...
                        </div>
                      )}

                      {reviewFeedback === 'incorrect' && (
                        <div style={{ 
                          padding: '0.75rem', 
                          backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                          border: '1px solid rgba(244, 67, 54, 0.3)',
                          borderRadius: '4px',
                          marginTop: '1rem',
                          textAlign: 'center'
                        }}>
                          <p style={{ color: '#f44336', marginBottom: '0.5rem' }}>✗ Wrong!</p>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Correct answer: <strong>{reviewWords[currentReviewIndex].en}</strong>
                          </p>
                        </div>
                      )}

                      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                        <button 
                          type="button"
                          className="btn-secondary" 
                          onClick={closeReview}
                        >
                          Stop
                        </button>
                        <button 
                          type="submit"
                          className="btn-primary" 
                          disabled={!reviewInput.trim() || reviewFeedback !== null}
                        >
                          {reviewFeedback === 'correct' ? 'Continue...' : 
                           reviewFeedback === 'incorrect' ? 'Try again...' : 
                           'Review'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>,
              document.body
            )}

          {/* QA Modal */}
          {isQAOpen &&
            createPortal(
              <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeQA}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                  <div className="modal-header">
                    <span className="label-mono">Question & Answer</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {qaQuestions.length > 0 && !isGeneratingQuestions && (
                        <button 
                          className="btn-secondary btn-small" 
                          onClick={() => regenerateQA()}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          title="Generate new questions"
                        >
                          Generate Again
                        </button>
                      )}
                      <button className="btn-icon" onClick={closeQA} aria-label="Close">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="modal-body">
                    {isGeneratingQuestions && (
                      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <p>Generating questions from conversation...</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          This may take a few seconds
                        </p>
                      </div>
                    )}

                    {qaError && (
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: 'rgba(244, 67, 54, 0.1)', 
                        border: '1px solid rgba(244, 67, 54, 0.3)',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        color: '#f44336'
                      }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Error</p>
                        <p style={{ fontSize: '0.875rem' }}>{qaError}</p>
                        <button 
                          className="btn-secondary btn-small" 
                          onClick={resetQA}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Reset
                        </button>
                      </div>
                    )}

                    {!isGeneratingQuestions && qaQuestions.length > 0 && (
                      <div>
                        {/* Progress indicator */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span className="label-mono" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              Question {currentQaIndex + 1} / {qaQuestions.length}
                            </span>
                            {qaEvaluations[currentQaIndex] && (
                              <span className="label-mono" style={{ color: 'var(--accent)' }}>
                                Score: {qaEvaluations[currentQaIndex].score}/10
                              </span>
                            )}
                          </div>
                          <div style={{ 
                            width: '100%', 
                            height: '4px', 
                            backgroundColor: 'var(--bg-secondary)', 
                            borderRadius: '2px',
                            overflow: 'hidden',
                            marginBottom: '1rem'
                          }}>
                            <div style={{ 
                              width: `${((currentQaIndex + 1) / qaQuestions.length) * 100}%`, 
                              height: '100%', 
                              backgroundColor: 'var(--accent)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>

                        {/* Current Question */}
                        <div style={{ 
                          padding: '1.5rem',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          marginBottom: '1.5rem'
                        }}>
                          <p style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: 600,
                            marginBottom: '1rem',
                            color: 'var(--gold)'
                          }}>
                            {qaQuestions[currentQaIndex].question}
                          </p>

                          {/* Answer Input */}
                          {!qaEvaluations[currentQaIndex] ? (
                            <form onSubmit={handleQASubmit}>
                              <label className="file-field">
                                <span className="label-mono">Your Answer</span>
                                <textarea
                                  ref={qaInputRef}
                                  className="input"
                                  rows={4}
                                  value={qaAnswers[currentQaIndex] || ''}
                                  onChange={(e) => {
                                    const newAnswers = [...qaAnswers]
                                    newAnswers[currentQaIndex] = e.target.value
                                    setQaAnswers(newAnswers)
                                  }}
                                  placeholder="Type your answer in English..."
                                  disabled={isEvaluatingAnswer}
                                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                                />
                              </label>
                              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                                <button 
                                  type="button"
                                  className="btn-secondary" 
                                  onClick={closeQA}
                                >
                                  Stop
                                </button>
                                <button 
                                  type="submit"
                                  className="btn-primary"
                                  disabled={!qaAnswers[currentQaIndex]?.trim() || isEvaluatingAnswer}
                                >
                                  {isEvaluatingAnswer ? 'Evaluating...' : 'Submit Answer'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            /* Evaluation Results */
                            <div>
                              <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                  <p style={{ 
                                    fontSize: '1.5rem', 
                                    fontWeight: 700,
                                    color: qaEvaluations[currentQaIndex].score >= 7 
                                      ? '#4caf50' 
                                      : qaEvaluations[currentQaIndex].score >= 5
                                      ? '#ffc107'
                                      : '#f44336'
                                  }}>
                                    Score: {qaEvaluations[currentQaIndex].score}/10
                                  </p>
                                </div>

                                {qaEvaluations[currentQaIndex].correctedAnswer && (
                                  <div style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
                                    <span className="label-mono" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Suggested Correction</span>
                                    <p style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                      {qaEvaluations[currentQaIndex].correctedAnswer}
                                    </p>
                                  </div>
                                )}

                                <div style={{ marginTop: qaEvaluations[currentQaIndex].correctedAnswer ? '1rem' : '0.75rem', paddingTop: qaEvaluations[currentQaIndex].correctedAnswer ? '1rem' : '0', borderTop: qaEvaluations[currentQaIndex].correctedAnswer ? '1px solid var(--bg-secondary)' : 'none' }}>
                                  <span className="label-mono" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>Feedback</span>
                                  <p style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                                    {qaEvaluations[currentQaIndex].feedback}
                                  </p>
                                </div>
                              </div>

                              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                                <button 
                                  type="button"
                                  className="btn-secondary" 
                                  onClick={closeQA}
                                >
                                  Stop
                                </button>
                                {currentQaIndex < qaQuestions.length - 1 ? (
                                  <button
                                    className="btn-primary"
                                    onClick={() => {
                                      setCurrentQaIndex(currentQaIndex + 1)
                                      qaInputRef.current?.focus()
                                    }}
                                  >
                                    Next Question
                                  </button>
                                ) : (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      className="btn-secondary"
                                      onClick={() => {
                                        const avgScore = qaEvaluations.reduce((sum, e) => sum + e.score, 0) / qaEvaluations.length
                                        alert(`Quiz completed! Average score: ${avgScore.toFixed(1)}/10`)
                                      }}
                                    >
                                      View Summary
                                    </button>
                                    <button
                                      className="btn-primary"
                                      onClick={resetQA}
                                    >
                                      Start Over
                                    </button>
                                  </div>
                                )}
                                {currentQaIndex > 0 && (
                                  <button
                                    className="btn-secondary"
                                    onClick={() => {
                                      setCurrentQaIndex(currentQaIndex - 1)
                                      qaInputRef.current?.focus()
                                    }}
                                  >
                                    Previous
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!isGeneratingQuestions && qaQuestions.length === 0 && !qaError && (
                      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <p>Question & Answer Mode</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                          AI will generate questions based on the conversation transcript
                        </p>
                        <button className="btn-primary" onClick={() => startQA()}>
                          Generate Questions
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      </section>
    </main>
  )
}

