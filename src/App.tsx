import { useMemo, useState, useEffect } from 'react'
import './App.css'
import { useLessons } from './hooks/useLessons'
import { useVocabulary } from './hooks/useVocabulary'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import PlayerScreen from './components/PlayerScreen'
import LessonsScreen from './components/LessonsScreen'
import VocabularyScreen from './components/VocabularyScreen'
import AddLessonModal from './components/AddLessonModal'
import type { Screen } from './types'

function App() {
  // Load lessons only for activeLesson (used in Navigation and PlayerScreen)
  const { lessons, refetch: refetchLessons } = useLessons()
  const { vocabulary } = useVocabulary()
  const [screen, setScreen] = useState<Screen>('player')
  const [activeLessonId, setActiveLessonId] = useState<string>('')
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false)

  // Set initial active lesson when lessons are loaded
  useEffect(() => {
    if (lessons.length > 0 && !activeLessonId) {
      setActiveLessonId(lessons[0].id)
    }
  }, [lessons, activeLessonId])

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeLessonId) ?? lessons[0] ?? null,
    [lessons, activeLessonId],
  )

  return (
    <div className="app-shell">
      <div className="ripple-background">
        <div className="ripple ripple-1" />
        <div className="ripple ripple-2" />
        <div className="ripple ripple-3" />
        <div className="ripple ripple-4" />
      </div>

      <Navigation activeScreen={screen} onChange={setScreen} activeLesson={activeLesson} />

      {screen === 'lesson' && (
        <LessonsScreen
          activeLessonId={activeLessonId}
          onSelectLesson={(id) => {
            setActiveLessonId(id)
            setScreen('player')
          }}
          onAddLessonClick={() => setIsAddLessonOpen(true)}
        />
      )}
      {screen === 'player' && (
        <PlayerScreen activeLesson={activeLesson} vocabulary={vocabulary} />
      )}
      {screen === 'vocabulary' && <VocabularyScreen vocabulary={vocabulary} />}
      
      <Footer />

      <AddLessonModal 
        isOpen={isAddLessonOpen} 
        onClose={() => setIsAddLessonOpen(false)}
        onImportSuccess={refetchLessons}
      />
    </div>
  )
}

export default App
