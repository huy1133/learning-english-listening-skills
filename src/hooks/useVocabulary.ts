import { useState, useEffect } from 'react'
import { loadVocabularyFromFirebase } from '../services/vocabularyService'
import type { VocabularyItem } from '../types'

interface UseVocabularyResult {
  vocabulary: VocabularyItem[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Custom hook to load vocabulary from Firebase
 */
export function useVocabulary(): UseVocabularyResult {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadVocabulary = async () => {
    setLoading(true)
    setError(null)

    try {
      const firebaseVocabulary = await loadVocabularyFromFirebase()
      setVocabulary(firebaseVocabulary)
    } catch (err) {
      console.error('Failed to load vocabulary from Firebase:', err)
      setError(err instanceof Error ? err : new Error('Failed to load vocabulary'))
      setVocabulary([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVocabulary()
  }, [])

  return {
    vocabulary,
    loading,
    error,
    refetch: loadVocabulary,
  }
}

