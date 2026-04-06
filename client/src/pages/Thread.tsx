import { useParams } from 'react-router-dom'

export function Thread() {
  const { slug, id } = useParams()
  return <div className="text-sm">Thread view - slug: {slug} - id: {id}</div>
}