import MessengerCampaignDetail from '@views/messenger/MessengerCampaignDetail'

const MessengerCampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <MessengerCampaignDetail id={params.id} />
}

export default MessengerCampaignDetailPage
