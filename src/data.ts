import type { Lesson, VocabularyItem } from './types'
import firebaseData from '../mockdata.firebase.json'

// Transform Firebase JSON structure to app types
export const lessons: Lesson[] = Object.values(firebaseData.lessons).map((l: any) => ({
  id: l.id,
  content: l.content,
  uploadedBy: l.uploadedBy,
  english: l.english,
  vietnamese: l.vietnamese,
  audio: {
    filename: l._audio.filename,
    url: l._audio.url,
    duration: l._audio.duration,
  },
  archived: l.archived ?? false,
  createdAt: l.createdAt,
}))

export const vocabulary: VocabularyItem[] = Object.entries(firebaseData.vocabulary).map(([id, v]: [string, any]) => ({
  id,
  en: v.en,
  vi: v.vi,
  sourceLesson: v.sourceLesson,
}))

