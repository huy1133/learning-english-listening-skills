import { useMemo, useState } from 'react'
import './App.css'
import { lessons, vocabulary } from './data'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import PlayerScreen from './components/PlayerScreen'
import LessonsScreen from './components/LessonsScreen'
import VocabularyScreen from './components/VocabularyScreen'
import AddLessonModal from './components/AddLessonModal'
import type { Screen } from './types'

function App() {
  const [screen, setScreen] = useState<Screen>('player')
  const [activeLessonId, setActiveLessonId] = useState<string>(lessons[0].id)
  const [lessonSearch, setLessonSearch] = useState('')
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false)
  const [lessonPage, setLessonPage] = useState(1)
  const LESSON_PAGE_SIZE = 10

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeLessonId) ?? lessons[0],
    [activeLessonId],
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
          lessons={lessons}
          activeLessonId={activeLessonId}
          onSelectLesson={setActiveLessonId}
          search={lessonSearch}
          onSearchChange={setLessonSearch}
          onAddLessonClick={() => setIsAddLessonOpen(true)}
          page={lessonPage}
          onPageChange={setLessonPage}
          pageSize={LESSON_PAGE_SIZE}
        />
      )}
      {screen === 'player' && <PlayerScreen activeLesson={activeLesson} vocabulary={vocabulary} />}
      {screen === 'vocabulary' && <VocabularyScreen vocabulary={vocabulary} />}
      
      <Footer />

      <AddLessonModal isOpen={isAddLessonOpen} onClose={() => setIsAddLessonOpen(false)} />
    </div>
  )
}

export default App
