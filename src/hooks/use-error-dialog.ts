import { useState, useCallback } from 'react'

interface ErrorDialogState {
  open: boolean
  title?: string
  description: string
}

export function useErrorDialog() {
  const [state, setState] = useState<ErrorDialogState>({
    open: false,
    description: '',
  })

  const showError = useCallback((description: string, title?: string) => {
    setState({
      open: true,
      title,
      description,
    })
  }, [])

  const hideError = useCallback(() => {
    setState(prev => ({ ...prev, open: false }))
  }, [])

  return {
    errorDialog: {
      ...state,
      onOpenChange: (open: boolean) => {
        if (!open) hideError()
      },
    },
    showError,
    hideError,
  }
}