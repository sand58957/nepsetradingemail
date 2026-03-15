import TelegramCampaignDetail from '@views/telegram/TelegramCampaignDetail'

const TelegramCampaignDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <TelegramCampaignDetail id={params.id} />
}

export default TelegramCampaignDetailPage
