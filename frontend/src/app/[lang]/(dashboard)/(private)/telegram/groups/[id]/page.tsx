import TelegramGroupDetail from '@views/telegram/TelegramGroupDetail'

const TelegramGroupDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <TelegramGroupDetail id={params.id} />
}

export default TelegramGroupDetailPage
