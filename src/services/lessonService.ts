import { ref, get, DataSnapshot, set } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '../firebase'
import { storage } from '../firebase'
import type { Lesson } from '../types'

interface FirebaseLessonData {
  id: string
  content: string
  uploadedBy: string
  english: string
  vietnamese: string
  _audio: {
    filename: string
    url: string
    duration: number
  }
  difficulty: number,
  archived?: boolean
  createdAt: string
}

/**
 * Load all lessons from Firebase Realtime Database
 */
export async function loadLessonsFromFirebase(): Promise<Lesson[]> {
  try {
    const lessonsRef = ref(db, 'lessons')
    const snapshot: DataSnapshot = await get(lessonsRef)

    if (!snapshot.exists()) {
      console.warn('No lessons found in Firebase')
      return []
    }

    const lessonsData = snapshot.val() as Record<string, FirebaseLessonData>
    
    // Transform Firebase data structure to app Lesson type
    const lessons: Lesson[] = Object.values(lessonsData)
      .filter((l) => !l.archived) // Filter out archived lessons
      .map((l) => ({
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
        difficulty: l.difficulty,
        archived: l.archived ?? false,
        createdAt: l.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Sort by newest first

    return lessons
  } catch (error) {
    console.error('Error loading lessons from Firebase:', error)
    throw error
  }
}

/**
 * Load a single lesson by ID from Firebase
 */
export async function loadLessonById(lessonId: string): Promise<Lesson | null> {
  try {
    const lessonRef = ref(db, `lessons/${lessonId}`)
    const snapshot: DataSnapshot = await get(lessonRef)

    if (!snapshot.exists()) {
      return null
    }

    const lessonData = snapshot.val() as FirebaseLessonData

    return {
      id: lessonData.id,
      content: lessonData.content,
      uploadedBy: lessonData.uploadedBy,
      english: lessonData.english,
      vietnamese: lessonData.vietnamese,
      audio: {
        filename: lessonData._audio.filename,
        url: lessonData._audio.url,
        duration: lessonData._audio.duration,
      },
      difficulty: lessonData.difficulty,
      archived: lessonData.archived ?? false,
      createdAt: lessonData.createdAt,
    }
  } catch (error) {
    console.error(`Error loading lesson ${lessonId} from Firebase:`, error)
    throw error
  }
}

/**
 * Add a new lesson to Firebase Realtime Database
 * Throws error if lesson already exists
 */
export async function addLessonToFirebase(lesson: Lesson): Promise<void> {
  try {
    const lessonRef = ref(db, `lessons/${lesson.id}`)
    const snapshot: DataSnapshot = await get(lessonRef)

    if (snapshot.exists()) {
      throw new Error('Lesson already exists')
    }
    
    // Transform Lesson type to Firebase structure
    const firebaseLessonData: FirebaseLessonData = {
      id: lesson.id,
      content: lesson.content,
      uploadedBy: lesson.uploadedBy,
      english: lesson.english,
      vietnamese: lesson.vietnamese,
      _audio: {
        filename: lesson.audio.filename,
        url: lesson.audio.url,
        duration: lesson.audio.duration,
      },
      difficulty: lesson.difficulty,
      archived: lesson.archived,
      createdAt: lesson.createdAt,
    }
    
    await set(lessonRef, firebaseLessonData)
  } catch (error) {
    console.error('Error adding lesson to Firebase:', error)
    throw error
  }
}

export async function uploadAudioToStorage(audio: File, lessonId: string): Promise<{ url: string, duration: number, fileName: string }> {
  try {
    const ext = audio.name.split('.').pop() ?? 'wav'
    const fileName = `audio_${lessonId}.${ext}`

    const audioRef = storageRef(storage, `audio/${fileName}`)
    await uploadBytes(audioRef, audio)
    const url = await getDownloadURL(audioRef)
    const duration = await getAudioDuration(audio)
    return { url, duration, fileName }
  } catch (error) {
    console.error('Error uploading audio to Firebase:', error)
    throw new Error('Failed to upload audio')
  }
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    audio.src = URL.createObjectURL(file)

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src)
      resolve(audio.duration)
    }

    audio.onerror = () => reject(new Error('Failed to load audio metadata'))
  })
}
