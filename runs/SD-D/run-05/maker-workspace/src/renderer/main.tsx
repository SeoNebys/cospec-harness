import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Collection } from './views/Collection'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Collection />
  </StrictMode>
)
