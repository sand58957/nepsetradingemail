// Component Imports
import WACampaignDetail from '@views/whatsapp/WACampaignDetail'

const WhatsAppCampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <WACampaignDetail id={params.id} />
}

export default WhatsAppCampaignDetailPage
