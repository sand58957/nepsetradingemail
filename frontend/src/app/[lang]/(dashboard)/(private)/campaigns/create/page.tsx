'use client'

import { useSearchParams } from 'next/navigation'

import CreateCampaign from '@views/email/campaigns/CreateCampaign'
import ChooseCampaignType from '@views/email/campaigns/ChooseCampaignType'

const CreateCampaignPage = () => {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')

  if (!type) {
    return <ChooseCampaignType />
  }

  return <CreateCampaign />
}

export default CreateCampaignPage
