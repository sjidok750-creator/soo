import { useState } from 'react'
import SubjectList from './SubjectList'
import SubjectDetail from './SubjectDetail'

export default function App() {
  const [currentSubject, setCurrentSubject] = useState(null)

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
