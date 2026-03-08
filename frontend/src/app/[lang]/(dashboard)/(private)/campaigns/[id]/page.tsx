// Component Imports
import CampaignDetail from '@views/email/campaigns/CampaignDetail'

const CampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <CampaignDetail id={params.id} />
}

export default CampaignDetailPage
