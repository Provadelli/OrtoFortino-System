import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { SkipLink } from './components/layout/SkipLink'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkipLink />
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  </StrictMode>,
)
