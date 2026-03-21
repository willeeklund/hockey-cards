import './SelectionBar.css'

export default function SelectionBar({ cards, selectedIds, onChange }) {
  const allSelected = selectedIds.size === cards.length
  const noneSelected = selectedIds.size === 0

  function toggle(id) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  function selectAll() {
    onChange(new Set(cards.map(c => c.id)))
  }

  function selectNone() {
    onChange(new Set())
  }

  return (
    <div className="selection-bar no-print">
      <div className="selection-bar-inner">
        <span className="selection-label">Välj kort:</span>

        <div className="chip-list">
          {cards.map(card => {
            const selected = selectedIds.has(card.id)
            return (
              <button
                key={card.id}
                className={`chip ${selected ? 'chip--on' : 'chip--off'}`}
                style={selected ? { '--chip-color': card.color || '#888' } : {}}
                onClick={() => toggle(card.id)}
                title={selected ? 'Klicka för att ta bort' : 'Klicka för att lägga till'}
              >
                <span className="chip-emoji">{card.emoji || '⭐'}</span>
                <span className="chip-title">{card.title}</span>
                {selected && <span className="chip-check">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="selection-actions">
          <button
            className="sel-btn"
            onClick={selectAll}
            disabled={allSelected}
          >
            Alla
          </button>
          <button
            className="sel-btn"
            onClick={selectNone}
            disabled={noneSelected}
          >
            Rensa
          </button>
        </div>
      </div>
    </div>
  )
}
