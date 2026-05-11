import './FilterBar.css'

type Props = {
  /** Each inner array is a mutually-exclusive group of tags. Picking one
   *  in a group automatically deselects the others in the same group. */
  tagGroups: readonly (readonly string[])[]
  activeTags: Set<string>
  onToggleTag: (tag: string) => void
}

/**
 * Filter controls for the exercise list. Each tag group is rendered as a
 * segmented control: clicking an inactive option in a group activates it
 * (and deactivates whatever was previously active in that group); clicking
 * the already-active option turns it off, so the group has no filter.
 *
 * Groups are independent — picking one option in group A doesn't touch
 * group B, so filters stack with AND semantics across groups.
 */
export default function FilterBar({ tagGroups, activeTags, onToggleTag }: Props) {
  return (
    <div className="filter-bar no-print">
      <div className="filter-bar-inner">
        <span className="filter-bar-label">Filtrera:</span>
        <div className="filter-bar-groups">
          {tagGroups.map((group, gi) => (
            <div key={gi} className="filter-bar-group" role="group">
              {group.map((tag) => {
                const on = activeTags.has(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`filter-bar-group-btn${on ? ' filter-bar-group-btn--on' : ''}`}
                    onClick={() => onToggleTag(tag)}
                    aria-pressed={on}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
