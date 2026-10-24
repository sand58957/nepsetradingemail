'use client'

import { useParams } from 'next/navigation'

import PhoneSMSGroupDetail from '@views/phone-sms/PhoneSMSGroupDetail'

const SMSGroupDetailPage = () => {
  const { id } = useParams()
  const groupId = parseInt(id as string, 10)

  if (isNaN(groupId)) return null

  return <PhoneSMSGroupDetail groupId={groupId} />
}

export default SMSGroupDetailPage
