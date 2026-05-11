import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import ExerciseCard from './components/ExerciseCard'
import CardBack from './components/CardBack'
import CardEditModal from './components/CardEditModal'
import SelectionBar from './components/SelectionBar'
import TeamSelector from './components/TeamSelector'
import TeamPicker from './components/TeamPicker'
import { useTeam } from './context/TeamContext'
import { FALLBACK_TEAM_ID } from './config/teams'
import { parseCard } from './utils/parseCard'
import './App.css'

// Tag list controls both the filter chips in the toolbar AND the card sort
// order — cards are grouped by their first matching tag from this list, in
// this order. Cards with none of these tags are placed at the end.
const ALL_TAGS = ['Klubbteknik', 'Rörlighet', 'Parövningar', 'Individuella']

async function fetchAllCards() {
  const listRes = await fetch('/api/content')
  if (!listRes.ok) throw new Error(`HTTP ${listRes.status} från /api/content`)
  const { ids } = (await listRes.json()) as { ids: string[] }

  const parsed = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`/content/${id}.md`)
        if (!res.ok) return null
        const raw = await res.text()
        const { id: parsedId, data } = parseCard(raw, `${id}.md`)
        return { id: parsedId, ...data }
      } catch {
        return null
      }
    })
  )
  return parsed.filter((c): c is { id: string; [key: string]: any } => c !== null)
}

function primaryTagIndex(card) {
  const cardTags = card.tags || []
  for (let i = 0; i < ALL_TAGS.length; i++) {
    if (cardTags.includes(ALL_TAGS[i])) return i
  }
  return ALL_TAGS.length
}

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
  const { teamId } = useTeam()
  // Display images fall back to the most-populated team when nothing has
  // been picked yet. Upload paths still require a real teamId.
  const displayTeamId = teamId ?? FALLBACK_TEAM_ID
  const [pickerOpen, setPickerOpen] = useState(false)

  // Cards are now fetched from /api/content + /content/<id>.md at runtime
  // (used to be bundled via import.meta.glob). The two effects below load
  // the list once on mount and initialise the user-visible selection /
  // crops once the list arrives.
  const [cards, setCards] = useState<Array<{ id: string; [key: string]: any }>>([])
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [contentError, setContentError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchAllCards()
      .then(loaded => {
        if (cancelled) return
        loaded.sort((a, b) => primaryTagIndex(a) - primaryTagIndex(b))
        setCards(loaded)
        setContentStatus('ready')
      })
      .catch((e: any) => {
        if (cancelled) return
        setContentError(e?.message ?? 'Okänt fel')
        setContentStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  // Initialise from URL
  const urlInit = useMemo(() => readUrl(), [])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(urlInit.edit)
  const [activeTags, setActiveTags] = useState<Set<string>>(() => {
    if (!urlInit.tags) return new Set()
    return new Set(urlInit.tags.split(',').filter(t => ALL_TAGS.includes(t)))
  })
  const [transforms, setTransforms] = useState<Record<string, any>>({})

  // First time cards arrive, derive default selectedIds, validate the
  // ?edit=… URL param against the loaded set, and seed transforms from
  // localStorage. After the first hydration we keep the user's existing
  // selection — adding a new exercise won't clobber what's selected.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (cards.length === 0) return
    if (hydratedRef.current) return
    hydratedRef.current = true

    const validIds = new Set(cards.map(c => c.id))
    setSelectedIds(
      urlInit.cards
        ? new Set(urlInit.cards.split(',').filter(id => validIds.has(id)))
        : validIds
    )
    if (urlInit.edit && !validIds.has(urlInit.edit)) setEditId(null)
    setTransforms(loadLocalCrops(cards))
  }, [cards, urlInit])

  // Sync URL whenever relevant state changes
  useEffect(() => {
    writeUrl(selectedIds, cards, editId, activeTags)
  }, [selectedIds, editId, activeTags, cards])

  // Load saved crops from server for the active (or fallback) team.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      cards.map(c =>
        fetch(`/exercise_images/${displayTeamId}/${c.id}.json`)
          .then(r => r.ok ? r.json().then(crop => ({ id: c.id, crop })) : null)
          .catch(() => null)
      )
    ).then(results => {
      if (cancelled) return
      const updates = {}
      results.forEach(r => { if (r) updates[r.id] = r.crop })
      if (Object.keys(updates).length > 0) {
        setTransforms(t => {
          const merged = { ...t }
          Object.entries(updates).forEach(([id, crop]) => { merged[id] = crop })
          return merged
        })
      }
    })
    return () => { cancelled = true }
  }, [cards, displayTeamId])

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

  if (contentStatus === 'loading') {
    return (
      <div className="app-loading">
        <p>Laddar övningar…</p>
      </div>
    )
  }

  if (contentStatus === 'error') {
    return (
      <div className="app-loading app-loading--error">
        <p>Kunde inte ladda övningar.</p>
        <p className="app-loading-detail">{contentError}</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="toolbar no-print">
        <div className="toolbar-inner">
          <span className="toolbar-logo">🏒</span>
          <span className="toolbar-title">Hockey Övningskort</span>

          <TeamSelector onSwitch={() => setPickerOpen(true)} />

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
              <div className="card-back-page">
                <div className="card-back-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
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

      {/* ── Team picker ──────────────────────────────────────────────────
          Forced (no onClose) on first load, when nothing is selected yet.
          Dismissible when the user opened it via the "Byt lag" button. */}
      {teamId === null && <TeamPicker />}
      {teamId !== null && pickerOpen && (
        <TeamPicker onClose={() => setPickerOpen(false)} />
      )}
    </>
  )
}

export default App
