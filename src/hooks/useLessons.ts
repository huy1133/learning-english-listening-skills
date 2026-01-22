import { useState, useEffect } from 'react'
import { loadLessonsFromFirebase } from '../services/lessonService'
import type { Lesson } from '../types'

interface UseLessonsResult {
  lessons: Lesson[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to load lessons from Firebase
 */
export function useLessons(): UseLessonsResult {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadLessons = async () => {
    setLoading(true)
    setError(null)

    try {
      const firebaseLessons = await loadLessonsFromFirebase()
      setLessons(firebaseLessons)
    } catch (err) {
      console.error('Failed to load lessons from Firebase:', err)
      setError(err instanceof Error ? err : new Error('Failed to load lessons'))
      setLessons([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLessons()
  }, [])

  return {
    lessons,
    loading,
    error,
    refetch: loadLessons,
  }
}

