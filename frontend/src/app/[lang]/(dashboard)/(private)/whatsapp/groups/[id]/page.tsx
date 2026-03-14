'use client'

import { useParams } from 'next/navigation'

import WAGroupDetail from '@views/whatsapp/WAGroupDetail'

const WAGroupDetailPage = () => {
  const { id } = useParams()
  const groupId = parseInt(id as string, 10)

  if (isNaN(groupId)) return null

  return <WAGroupDetail groupId={groupId} />
}

export default WAGroupDetailPage
