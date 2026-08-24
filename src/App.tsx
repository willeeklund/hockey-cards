import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import ExerciseCard from './components/ExerciseCard'
import CardBack from './components/CardBack'
import CardEditModal from './components/CardEditModal'
import SelectionBar from './components/SelectionBar'
import FilterBar from './components/FilterBar'
import TeamSelector from './components/TeamSelector'
import TeamPicker from './components/TeamPicker'
import NewExerciseModal from './components/NewExerciseModal'
import { useTeam } from './context/TeamContext'
import { FALLBACK_TEAM_ID } from './config/teams'
import { parseCard } from './utils/parseCard'
import { assetUrl } from './utils/assetUrl'
import './App.css'

// Filter dimensions, each one a mutually-exclusive group: a card is either
// klubbteknik OR rörlighet (never both), either parövning OR individuell,
// and either litet-utrymme OR kräver-redskap. Picking one option in a
// group deselects the other.
//
// The first two groups are exhaustive — every card has one of each. The
// third (space/equipment) is optional; cards that need open floor but no
// equipment can stay untagged in that group and show up in either filter.
//
// The flat list (TAG_GROUPS.flat()) also controls card sort order.
const TAG_GROUPS = [
  ['Klubbteknik', 'Rörlighet'],
  ['Parövningar', 'Individuella'],
  ['Litet utrymme', 'Med redskap'],
] as const
const ALL_TAGS = TAG_GROUPS.flat()

async function fetchAllCards() {
  // Bypass any browser cache — the list and each .md file change every
  // time a user creates or edits an exercise, and we re-fetch immediately
  // after those mutations.
  const listRes = import.meta.env.VITE_READ_ONLY
    ? await fetch(assetUrl('/content-index.json'), { cache: 'no-store' })
    : await fetch('/api/content', { cache: 'no-store' })
  if (!listRes.ok) throw new Error(`HTTP ${listRes.status} från /api/content`)
  const { ids } = (await listRes.json()) as { ids: string[] }

  const parsed = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(assetUrl(`/content/${id}.md`), { cache: 'no-store' })
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

/** Returns the subset of `cards` whose tags include *every* active tag. */
function filterCardsByTags(cards, activeTags) {
  if (activeTags.size === 0) return cards
  return cards.filter(c => {
    const cardTags = new Set(c.tags || [])
    for (const t of activeTags) {
      if (!cardTags.has(t)) return false
    }
    return true
  })
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
  const [newExerciseOpen, setNewExerciseOpen] = useState(false)

  // Cards are now fetched from /api/content + /content/<id>.md at runtime
  // (used to be bundled via import.meta.glob). The two effects below load
  // the list once on mount and initialise the user-visible selection /
  // crops once the list arrives.
  const [cards, setCards] = useState<Array<{ id: string; [key: string]: any }>>([])
  const [contentStatus, setContentStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [contentError, setContentError] = useState('')

  // `<img>` elements bypass the fetch() cache options, so when an image is
  // re-uploaded the URL is identical and the browser serves the previously
  // loaded bytes. Bump this counter on every non-initial refresh and append
  // it as `?v=<n>` to image URLs to force a re-fetch only when needed.
  const [imageVersion, setImageVersion] = useState(0)

  // Re-fetch the card list (after create / update / blob-storage edit).
  // Same code path as the initial load; on initial load we also flip the
  // load status to 'ready' so the loading screen goes away.
  const refreshCards = useCallback(async (opts: { initial?: boolean } = {}) => {
    try {
      const loaded = await fetchAllCards()
      loaded.sort((a, b) => primaryTagIndex(a) - primaryTagIndex(b))
      setCards(loaded)
      setContentStatus('ready')
      if (!opts.initial) {
        // After a user-triggered save we bump the version so freshly
        // uploaded images replace the cached ones in <img> elements.
        setImageVersion((v) => v + 1)
      }
    } catch (e: any) {
      if (opts.initial) {
        setContentError(e?.message ?? 'Okänt fel')
        setContentStatus('error')
      }
      throw e
    }
  }, [])

  useEffect(() => {
    refreshCards({ initial: true }).catch(() => { /* state already updated */ })
  }, [refreshCards])

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
  // Re-runs when imageVersion bumps so a freshly-saved crop is read back
  // instead of served from the browser cache.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      cards.map(c =>
        fetch(assetUrl(`/exercise_images/${displayTeamId}/${c.id}.json`), { cache: 'no-store' })
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
  }, [cards, displayTeamId, imageVersion])

  const updateTransform = useCallback((cardId, next) => {
    setTransforms(t => ({ ...t, [cardId]: next }))
    saveLocalCrop(cardId, next)
  }, [])

  const getTransform = useCallback((cardId) => transforms[cardId] || DEFAULT_XFORM, [transforms])

  // ── Filtered cards (AND across active tags) ────────────────────────
  // No active tags → show everything. One or more active tags → a card
  // must have *all* of them to be included. (Match the "stacking filters
  // narrow the set" mental model rather than "any-of".)
  const filteredCards = useMemo(
    () => filterCardsByTags(cards, activeTags),
    [cards, activeTags]
  )

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
      if (next.has(tag)) {
        // Click on the already-active tag in its group → turn the group off.
        next.delete(tag)
      } else {
        // Activating a new tag: clear the rest of its group first so only
        // one tag per group is ever active.
        const group = TAG_GROUPS.find((g) => (g as readonly string[]).includes(tag))
        if (group) for (const t of group) next.delete(t)
        next.add(tag)
      }
      // Every time the filter changes, snap the selection to the new
      // filtered set so it's obvious which cards are currently active
      // for printing. The user can then click individual chips to refine.
      const nextFiltered = filterCardsByTags(cards, next)
      setSelectedIds(new Set(nextFiltered.map(c => c.id)))
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
          <span className="toolbar-title">IK Göta Off-ice övningskort</span>

          <TeamSelector onSwitch={() => setPickerOpen(true)} />

          <span className="toolbar-spacer" aria-hidden />

          {!import.meta.env.VITE_READ_ONLY && (
            <button
              className="new-exercise-toolbar-btn"
              onClick={() => setNewExerciseOpen(true)}
              title="Skapa en ny övning"
            >
              <span className="btn-icon" aria-hidden>✨</span>
              <span className="btn-label">Ny övning</span>
            </button>
          )}

          <button
            className="print-btn"
            onClick={() => window.print()}
            disabled={selectedIds.size === 0}
            title="Skriv ut valda kort"
          >
            <span className="btn-icon" aria-hidden>🖨️</span>
            <span className="btn-label">Skriv ut</span>
            {selectedIds.size > 0 && <span className="btn-count">({selectedIds.size})</span>}
          </button>
        </div>
      </div>

      {/* ── Filter ───────────────────────────────────────────────────── */}
      <FilterBar
        tagGroups={TAG_GROUPS}
        activeTags={activeTags}
        onToggleTag={toggleTag}
      />

      {/* ── Per-card selection chips ─────────────────────────────────── */}
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
                    imageVersion={imageVersion}
                    onEdit={import.meta.env.VITE_READ_ONLY ? undefined : () => setEditId(card.id)}
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
          imageVersion={imageVersion}
          onTransformChange={next => updateTransform(editCard.id, next)}
          onClose={() => setEditId(null)}
          onSaved={() => refreshCards()}
        />
      )}

      {/* ── New exercise modal ───────────────────────────────────────── */}
      {newExerciseOpen && (
        <NewExerciseModal
          existingIds={new Set(cards.map(c => c.id))}
          onClose={() => setNewExerciseOpen(false)}
          onCreated={async (id) => {
            // Refresh the full list (no cache) so the new card appears
            // immediately, and pre-select it. The NewExerciseModal closes
            // itself once this callback resolves; the user lands back on
            // the main view with the new exercise visible in the list.
            await refreshCards()
            setSelectedIds(prev => new Set([...prev, id]))
          }}
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
