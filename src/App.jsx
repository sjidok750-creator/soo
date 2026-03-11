import { useState } from 'react'
import SplashScreen from './SplashScreen'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [currentSubject, setCurrentSubject] = useState(null)

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />
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
    <SubjectList onSelectSubject={setCurrentSubject} />
  )
}
