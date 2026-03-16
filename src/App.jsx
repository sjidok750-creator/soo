import { useState } from 'react'
import SplashScreen from './SplashScreen'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'
import NotesPage from './NotesPage'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [currentSubject, setCurrentSubject] = useState(null)
  const [showNotes, setShowNotes] = useState(false)

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
  }

  if (showNotes) {
    return <NotesPage onBack={() => setShowNotes(false)} />
  }

  if (currentSubject) {
    return (
      <SubjectDetail
        subject={currentSubject}
        onBack={() => setCurrentSubject(null)}
      />
    )
  }

  return (
    <SubjectList
      onSelectSubject={setCurrentSubject}
      onOpenNotes={() => setShowNotes(true)}
    />
  )
}
