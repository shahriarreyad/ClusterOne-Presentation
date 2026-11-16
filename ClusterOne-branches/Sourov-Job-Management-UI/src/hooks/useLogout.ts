import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function useLogout() {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestLogout = () => setConfirmOpen(true)
  const cancelLogout = () => setConfirmOpen(false)
  const confirmLogout = () => {
    setConfirmOpen(false)
    navigate('/logout')
  }

  return { confirmOpen, requestLogout, cancelLogout, confirmLogout }
}
