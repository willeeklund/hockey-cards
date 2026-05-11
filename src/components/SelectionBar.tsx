import './SelectionBar.css'

export default function SelectionBar({ cards, selectedIds, onChange }) {
  function toggle(id) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  return (
    <div className="selection-bar no-print">
      <div className="selection-bar-inner">
        <span className="selection-label">Välj enskilda kort:</span>

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
                {/* Always rendered so the chip stays the same width whether
                    or not it's selected — only the visibility toggles. */}
                <span className="chip-check" aria-hidden={!selected}>✓</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
