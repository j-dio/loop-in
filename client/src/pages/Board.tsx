import { useParams } from 'react-router-dom'

export function Board() {
  const { slug } = useParams()
  return <div className="text-sm">Public board - slug: {slug}</div>
}