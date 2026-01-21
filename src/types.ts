export type Screen = 'lesson' | 'player' | 'vocabulary'

export interface AudioInfo {
  filename: string
  url: string
  duration: number
}

export interface Lesson {
  id: string
  content: string
  uploadedBy: string
  english: string
  vietnamese: string
  audio: AudioInfo
  archived: boolean
  createdAt: string
}

export interface VocabularyItem {
  id: string
  en: string
  vi: string
  sourceLesson: string
}

