import type { Lesson, Screen } from '../types'
import './Navigation.css'

interface Props {
  activeScreen: Screen
  onChange: (screen: Screen) => void
  activeLesson: Lesson
}

const tabs: { id: Screen; label: string }[] = [
  { id: 'lesson', label: 'Lessons' },
  { id: 'player', label: 'Play' },
  { id: 'vocabulary', label: 'Vocabulary' },
]

function Navigation({ activeScreen, onChange, activeLesson }: Props) {
  return (
    <header className="topbar">
      <div>
        <span className="label-mono">LinguFlow</span>
        <p className="subtitle">version 1.0</p>
      </div>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeScreen === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="lesson-quick">
        <span className="label-mono">Now Focused</span>
        <p className="lesson-name">{activeLesson.content}</p>
        <p className="lesson-meta">
          Uploaded by {activeLesson.uploadedBy} · {Math.round(activeLesson.audio.duration)}s
        </p>
      </div>
    </header>
  )
}

export default Navigation

