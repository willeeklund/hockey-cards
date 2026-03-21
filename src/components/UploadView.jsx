import { useState } from 'react'
import './UploadView.css'

const TEAM_FOLDER = import.meta.env.IMAGES_FOLDER || 'ikgota-team16'

function getImageFilename(card) {
  return `${card.id}.jpg`
}

export default function UploadView({ cards }) {
  const [statuses, setStatuses] = useState({})   // id -> 'uploading' | 'success' | 'error'
  const [newPreviews, setNewPreviews] = useState({}) // id -> object URL efter uppladdning
  const [imgErrors, setImgErrors] = useState({})  // id -> true om befintlig bild saknas

  function setStatus(id, status) {
    setStatuses(s => ({ ...s, [id]: status }))
  }

  function handleFileChange(card, file) {
    if (!file) return
    setStatus(card.id, 'uploading')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result
      const filename = getImageFilename(card)

      setNewPreviews(p => ({ ...p, [card.id]: URL.createObjectURL(file) }))
      setImgErrors(e => ({ ...e, [card.id]: false }))

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, data: base64 }),
        })
        const json = await res.json()
        setStatus(card.id, json.ok ? 'success' : 'error')
      } catch {
        setStatus(card.id, 'error')
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="upload-view">
      <p className="upload-intro">
        Välj en övning och ladda upp ett foto direkt från kamerarullen – eller ta ett nytt!
      </p>

      {cards.map(card => {
        const status = statuses[card.id]
        const filename = getImageFilename(card)
        const existingSrc = `/exercise_images/${TEAM_FOLDER}/${card.id}.jpg`
        const previewSrc = newPreviews[card.id] || existingSrc
        const isMissing = imgErrors[card.id] && !newPreviews[card.id]

        return (
          <div key={card.id} className={`upload-item ${status || ''}`}>
            <div className="upload-item-left">
              <span className="upload-emoji">{card.emoji || '⭐'}</span>
              <div className="upload-meta">
                <div className="upload-title">{card.title}</div>
                {!isMissing && <div className="upload-filename">📁 {filename}</div>}
              </div>
            </div>

            <div className={`upload-thumb ${isMissing ? 'upload-thumb--missing' : ''}`}>
              {previewSrc && !isMissing ? (
                <img
                  src={previewSrc}
                  alt={card.title}
                  onError={() => setImgErrors(e => ({ ...e, [card.id]: true }))}
                />
              ) : (
                <span title="Bild saknas">?</span>
              )}
            </div>

            <label className={`upload-btn upload-btn--${status || 'idle'}`}>
              {status === 'uploading' && <><span className="spinner" /> Laddar upp…</>}
              {status === 'success' && <>✅ Klart!</>}
              {status === 'error' && <>❌ Försök igen</>}
              {!status && <>📷 Välj foto</>}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileChange(card, e.target.files[0])}
              />
            </label>
          </div>
        )
      })}
    </div>
  )
}
