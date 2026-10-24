import PhoneSMSCampaignDetail from '@views/phone-sms/PhoneSMSCampaignDetail'

const SMSCampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <PhoneSMSCampaignDetail id={params.id} />
}

export default SMSCampaignDetailPage
