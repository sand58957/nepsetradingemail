import SMSCampaignDetail from '@views/sms/SMSCampaignDetail'

const SMSCampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <SMSCampaignDetail id={params.id} />
}

export default SMSCampaignDetailPage
