'use client'

import { useParams } from 'next/navigation'

import AutomationEditor from '@views/email/automations/AutomationEditor'

const EditAutomationPage = () => {
  const params = useParams()
  const id = Number(params.id)

  return <AutomationEditor automationId={id} />
}

export default EditAutomationPage
