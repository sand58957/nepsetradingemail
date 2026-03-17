import MessengerGroupDetail from '@views/messenger/MessengerGroupDetail'

const MessengerGroupDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <MessengerGroupDetail id={params.id} />
}

export default MessengerGroupDetailPage
