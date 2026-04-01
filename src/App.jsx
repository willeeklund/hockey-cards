import { useMemo, useState, useEffect, useCallback } from 'react'
import ExerciseCard from './components/ExerciseCard'
import CardBack from './components/CardBack'
import CardEditModal from './components/CardEditModal'
import SelectionBar from './components/SelectionBar'
import { parseCard } from './utils/parseCard'
import './App.css'

const rawFiles = import.meta.glob('./content/*.md', { query: '?raw', import: 'default', eager: true })
const TEAM_FOLDER = import.meta.env.IMAGES_FOLDER || 'ikgota-team16'
const ALL_TAGS = ['Klubbteknik', 'Parövningar', 'Individuella', 'Rörlighet']

// ── URL helpers ────────────────────────────────────────────────────────
function readUrl() {
  const p = new URLSearchParams(window.location.search)
  return {
    cards: p.get('cards') || null,
    edit:  p.get('edit')  || null,
    tags:  p.get('tags')  || null,
  }
}

function writeUrl(selectedIds, allCards, editId, activeTags) {
  const p = new URLSearchParams()
  if (selectedIds.size !== allCards.length) p.set('cards', [...selectedIds].join(','))
  if (editId) p.set('edit', editId)
  if (activeTags.size > 0) p.set('tags', [...activeTags].join(','))
  const s = p.toString()
  history.replaceState(null, '', s ? `?${s}` : window.location.pathname)
}

// ── Transform (crop) helpers ───────────────────────────────────────────
const DEFAULT_XFORM = { x: 0, y: 0, scale: 1 }

function loadLocalCrops(cards) {
  const out = {}
  cards.forEach(c => {
    try {
      const s = localStorage.getItem(`img-crop-${c.id}`)
      if (s) out[c.id] = JSON.parse(s)
    } catch {}
  })
  return out
}

function saveLocalCrop(id, crop) {
  try { localStorage.setItem(`img-crop-${id}`, JSON.stringify(crop)) } catch {}
}

// ── App ────────────────────────────────────────────────────────────────
function App() {
  const cards = useMemo(() => {
    return Object.entries(rawFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([filePath, raw]) => {
        const { id, data } = parseCard(raw, filePath)
        return { id, ...data }
      })
  }, [])

  // Initialise from URL
  const urlInit = useMemo(() => readUrl(), [])

  const [selectedIds, setSelectedIds] = useState(() => {
    if (!urlInit.cards) return new Set(cards.map(c => c.id))
    const valid = new Set(cards.map(c => c.id))
    return new Set(urlInit.cards.split(',').filter(id => valid.has(id)))
  })

  const [editId, setEditId] = useState(() => {
    return urlInit.edit && cards.some(c => c.id === urlInit.edit) ? urlInit.edit : null
  })

  const [activeTags, setActiveTags] = useState(() => {
    if (!urlInit.tags) return new Set()
    return new Set(urlInit.tags.split(',').filter(t => ALL_TAGS.includes(t)))
  })

  const [transforms, setTransforms] = useState(() => loadLocalCrops(cards))

  // Sync URL whenever relevant state changes
  useEffect(() => {
    writeUrl(selectedIds, cards, editId, activeTags)
  }, [selectedIds, editId, activeTags, cards])

  // Load saved crops from server (background fetch for cards without local data)
  useEffect(() => {
    const missing = cards.filter(c => !transforms[c.id])
    if (missing.length === 0) return
    Promise.all(
      missing.map(c =>
        fetch(`/exercise_images/${TEAM_FOLDER}/${c.id}.json`)
          .then(r => r.ok ? r.json().then(crop => ({ id: c.id, crop })) : null)
          .catch(() => null)
      )
    ).then(results => {
      const updates = {}
      results.forEach(r => { if (r) updates[r.id] = r.crop })
      if (Object.keys(updates).length > 0) {
        setTransforms(t => {
          const merged = { ...t }
          Object.entries(updates).forEach(([id, crop]) => { if (!merged[id]) merged[id] = crop })
          return merged
        })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateTransform = useCallback((cardId, next) => {
    setTransforms(t => ({ ...t, [cardId]: next }))
    saveLocalCrop(cardId, next)
  }, [])

  const getTransform = useCallback((cardId) => transforms[cardId] || DEFAULT_XFORM, [transforms])

  // ── Filtered cards ─────────────────────────────────────────────────
  const filteredCards = useMemo(() => {
    if (activeTags.size === 0) return cards
    return cards.filter(c => (c.tags || []).some(t => activeTags.has(t)))
  }, [cards, activeTags])

  const selectedCards = useMemo(
    () => filteredCards.filter(c => selectedIds.has(c.id)),
    [filteredCards, selectedIds]
  )

  const pages = useMemo(() => {
    const result = []
    for (let i = 0; i < selectedCards.length; i += 6) result.push(selectedCards.slice(i, i + 6))
    return result
  }, [selectedCards])

  const editCard = editId ? cards.find(c => c.id === editId) : null

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="toolbar no-print">
        <div className="toolbar-inner">
          <span className="toolbar-logo">🏒</span>
          <span className="toolbar-title">Hockey Övningskort</span>

          {/* Tag filters */}
          <div className="tag-filters">
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                className={`tag-filter-btn ${activeTags.has(tag) ? 'tag-filter-btn--on' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <button
            className="print-btn"
            onClick={() => window.print()}
            disabled={selectedIds.size === 0}
          >
            🖨️ Skriv ut {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* ── Selection bar ────────────────────────────────────────────── */}
      <SelectionBar
        cards={filteredCards}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />

      {/* ── Cards grid ───────────────────────────────────────────────── */}
      {selectedIds.size === 0 ? (
        <div className="empty-state no-print">
          <p>Inga kort valda – välj minst ett kort ovan.</p>
        </div>
      ) : (
        <main className="pages">
          {pages.map((page, pageIdx) => (
            <div key={pageIdx} className="page-pair">
              <div className="card-page">
                {page.map((card, i) => (
                  <ExerciseCard
                    key={card.id}
                    card={card}
                    index={pageIdx * 6 + i}
                    transform={getTransform(card.id)}
                    onEdit={() => setEditId(card.id)}
                  />
                ))}
              </div>
              <div className="card-page card-back-page">
                <div className="card-back-grid">
                  {Array.from({ length: page.length }).map((_, i) => (
                    <CardBack key={i} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </main>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────── */}
      {editCard && (
        <CardEditModal
          card={editCard}
          transform={getTransform(editCard.id)}
          onTransformChange={next => updateTransform(editCard.id, next)}
          onClose={() => setEditId(null)}
        />
      )}
    </>
  )
}

export default App
