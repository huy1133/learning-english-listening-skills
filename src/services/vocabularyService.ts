import { ref, get, DataSnapshot, set, remove } from 'firebase/database'
import { db } from '../firebase'
import type { VocabularyItem } from '../types'

interface FirebaseVocabularyData {
  en: string
  vi: string
  sourceLesson: string
}

/**
 * Load all vocabulary from Firebase Realtime Database
 */
export async function loadVocabularyFromFirebase(): Promise<VocabularyItem[]> {
  try {
    const vocabularyRef = ref(db, 'vocabulary')
    const snapshot: DataSnapshot = await get(vocabularyRef)

    if (!snapshot.exists()) {
      console.warn('No vocabulary found in Firebase')
      return []
    }

    const vocabularyData = snapshot.val() as Record<string, FirebaseVocabularyData>
    
    // Transform Firebase data structure to app VocabularyItem type
    const vocabulary: VocabularyItem[] = Object.entries(vocabularyData).map(([id, v]) => ({
      id,
      en: v.en,
      vi: v.vi,
      sourceLesson: v.sourceLesson,
    }))

    return vocabulary
  } catch (error) {
    console.error('Error loading vocabulary from Firebase:', error)
    throw error
  }
}

export async function addVocabularyToFirebase(vocabulary: VocabularyItem): Promise<void> {
  try {
    const vocabularyRef = ref(db, `vocabulary/${vocabulary.id}`)
    await set(vocabularyRef, {
      en: vocabulary.en,
      vi: vocabulary.vi,
      sourceLesson: vocabulary.sourceLesson,
    })
  } catch (error) {
    console.error('Error adding vocabulary to Firebase:', error)
    throw error
  }
}

export async function deleteVocabularyFromFirebase(vocabularyId: string): Promise<void> {
  try {
    const vocabularyRef = ref(db, `vocabulary/${vocabularyId}`)
    await remove(vocabularyRef)
  } catch (error) {
    console.error('Error deleting vocabulary from Firebase:', error)
    throw error
  }
}