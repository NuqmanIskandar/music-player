import { useEffect, useState } from 'react'
import { session as storedSession, setUnauthorizedHandler } from './api'
import AuthPage from './components/AuthPage'
import MusicApp from './MusicApp'
import './App.css'

export default function App() {
  const [session, setSession] = useState(() => storedSession.get())

  // If the server rejects our token (expired, etc.), drop back to the sign-in screen.
  useEffect(() => setUnauthorizedHandler(() => setSession(null)), [])

  if (!session) {
    return (
      <AuthPage
        onAuthed={(s) => {
          storedSession.set(s)
          setSession(s)
        }}
      />
    )
  }

  return (
    <MusicApp
      key={session.user.id} // fresh state per account
      user={session.user}
      onLogout={() => {
        storedSession.clear()
        setSession(null)
      }}
    />
  )
}
