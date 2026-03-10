'use client'

import { useSearchParams } from 'next/navigation'

import CreateCampaign from '@views/email/campaigns/CreateCampaign'
import ChooseCampaignType from '@views/email/campaigns/ChooseCampaignType'
import TemplateGallery from '@views/email/campaigns/TemplateGallery'
import DragDropEmailEditor from '@views/email/campaigns/DragDropEmailEditor'

const CreateCampaignPage = () => {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const template = searchParams.get('template')
  const editor = searchParams.get('editor')

  // Step 1: No type → Choose campaign type
  if (!type) {
    return <ChooseCampaignType />
  }

  // Step 2: Type selected but no template → Show template gallery
  if (!template) {
    return <TemplateGallery campaignType={type} />
  }

  // Step 3: "Start from scratch" opens drag-and-drop editor (unless returning from editor)
  if (template === 'scratch' && editor !== 'done') {
    return <DragDropEmailEditor campaignType={type} />
  }

  // Step 4: Template selected or editor done → Show campaign creation form
  return <CreateCampaign />
}

export default CreateCampaignPage
