'use client'

import { useParams } from 'next/navigation'

import SMSGroupDetail from '@views/sms/SMSGroupDetail'

const SMSGroupDetailPage = () => {
  const { id } = useParams()
  const groupId = parseInt(id as string, 10)

  if (isNaN(groupId)) return null

  return <SMSGroupDetail groupId={groupId} />
}

export default SMSGroupDetailPage
