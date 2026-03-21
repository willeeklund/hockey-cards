import { useMemo, useState } from 'react'
import ExerciseCard from './components/ExerciseCard'
import UploadView from './components/UploadView'
import SelectionBar from './components/SelectionBar'
import { parseCard } from './utils/parseCard'
import './App.css'

const rawFiles = import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true })

function App() {
  const [view, setView] = useState('cards') // 'cards' | 'upload'

  const cards = useMemo(() => {
    return Object.entries(rawFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([filePath, raw]) => {
        const { id, data } = parseCard(raw, filePath)
        return { id, ...data }
      })
  }, [])

  const [selectedIds, setSelectedIds] = useState(() => new Set(cards.map(c => c.id)))

  const selectedCards = useMemo(
    () => cards.filter(c => selectedIds.has(c.id)),
    [cards, selectedIds]
  )

  const pages = useMemo(() => {
    const result = []
    for (let i = 0; i < selectedCards.length; i += 6) result.push(selectedCards.slice(i, i + 6))
    return result
  }, [selectedCards])

  return (
    <>
      <div className="toolbar no-print">
        <div className="toolbar-inner">
          <span className="toolbar-logo">🏒</span>
          <span className="toolbar-title">Hockey Övningskort</span>

          <nav className="toolbar-nav">
            <button
              className={`nav-btn ${view === 'cards' ? 'active' : ''}`}
              onClick={() => setView('cards')}
            >
              🃏 Kort
            </button>
            <button
              className={`nav-btn ${view === 'upload' ? 'active' : ''}`}
              onClick={() => setView('upload')}
            >
              📷 Ladda upp
            </button>
          </nav>

          {view === 'cards' && (
            <button
              className="print-btn"
              onClick={() => window.print()}
              disabled={selectedIds.size === 0}
            >
              🖨️ Skriv ut {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {view === 'cards' && (
        <SelectionBar
          cards={cards}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
        />
      )}

      {view === 'upload' ? (
        <UploadView cards={cards} />
      ) : selectedIds.size === 0 ? (
        <div className="empty-state no-print">
          <p>Inga kort valda – välj minst ett kort ovan.</p>
        </div>
      ) : (
        <main className="pages">
          {pages.map((page, pageIdx) => (
            <div key={pageIdx} className="card-page">
              {page.map((card, i) => (
                <ExerciseCard key={card.id} card={card} index={pageIdx * 4 + i} />
              ))}
            </div>
          ))}
        </main>
      )}
    </>
  )
}

export default App
