import { useParams } from 'react-router-dom'

export function Admin() {
  const { slug } = useParams()
  return <div className="text-sm">Command center - slug: {slug}</div>
}

