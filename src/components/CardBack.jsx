import './CardBack.css'

export default function CardBack() {
  return (
    <div className="card-back">
      <div className="card-back-inner">
        <img src="/gota-logga.png" alt="IK Göta" className="card-back-logo" />
        <p className="card-back-quote">
          Ju mer vi tränar,<br />desto mer tur har vi
        </p>
      </div>
    </div>
  )
}
