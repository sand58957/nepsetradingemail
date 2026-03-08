// Component Imports
import TemplateEditor from '@views/email/templates/TemplateEditor'

const TemplateEditorPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <TemplateEditor id={params.id} />
}

export default TemplateEditorPage
