'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import UnderlineExt from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'

import {
  Grid,
  Box,
  TextField,
  Typography,
  Button,
  IconButton,
  Divider,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Autocomplete,
  Chip,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material'
// Using tabler CSS classes instead of @tabler/icons-react

import { useSEOScore } from '@/hooks/useSEOScore'
import { blogService } from '@/services/blog'
import type { BlogCategory, BlogTag, BlogAuthor, CreatePostRequest } from '@/types/blog'

interface FAQItem {
  id?: number
  question: string
  answer: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractEditorData(editor: ReturnType<typeof useEditor>) {
  if (!editor) return { text: '', html: '', json: null, wordCount: 0, headings: [] as string[], hasImages: false, hasInternalLinks: false, hasExternalLinks: false, imagesHaveAlt: true }
  const text = editor.getText()
  const html = editor.getHTML()
  const json = editor.getJSON()
  const wordCount = text.split(/\s+/).filter(Boolean).length

  const headings: string[] = []
  const walk = (node: any) => {
    if (node.type === 'heading' && node.content) {
      headings.push(node.content.map((c: any) => c.text || '').join(''))
    }
    if (node.content) node.content.forEach(walk)
  }
  if (json) walk(json)

  const hasImages = html.includes('<img')
  const hasInternalLinks = html.includes('href="/')
  const hasExternalLinks = /href="https?:\/\//.test(html)

  let imagesHaveAlt = true
  const imgMatches = html.match(/<img[^>]*>/g)
  if (imgMatches) {
    imagesHaveAlt = imgMatches.every(tag => /alt="[^"]+"/i.test(tag))
  }

  return { text, html, json, wordCount, headings, hasImages, hasInternalLinks, hasExternalLinks, imagesHaveAlt }
}

export default function BlogPostEditor() {
  const params = useParams()
  const router = useRouter()
  const editId = params?.id ? Number(params.id) : null

  // Form state
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [excerpt, setExcerpt] = useState('')
  const [quickAnswer, setQuickAnswer] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [secondaryKeywords, setSecondaryKeywords] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [authorId, setAuthorId] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<BlogTag[]>([])
  const [featuredImageUrl, setFeaturedImageUrl] = useState('')
  const [canonicalUrl, setCanonicalUrl] = useState('')
  const [status, setStatus] = useState<string>('draft')
  const [faqs, setFaqs] = useState<FAQItem[]>([])

  // Data lists
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [tags, setTags] = useState<BlogTag[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Heading.configure({ levels: [2, 3, 4] }),
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing your blog post...' }),
      UnderlineExt,
      CharacterCount
    ],
    content: '',
    onUpdate: () => {}
  })

  // Derived editor data
  const editorData = useMemo(() => extractEditorData(editor), [editor, editor?.state.doc])

  // SEO Score
  const seoResult = useSEOScore({
    title,
    contentText: editorData.text,
    metaTitle,
    metaDescription,
    primaryKeyword,
    headings: editorData.headings,
    hasInternalLinks: editorData.hasInternalLinks,
    hasExternalLinks: editorData.hasExternalLinks,
    hasImages: editorData.hasImages,
    imagesHaveAlt: editorData.imagesHaveAlt,
    wordCount: editorData.wordCount,
    quickAnswer,
    hasFAQs: faqs.length > 0 && faqs.some(f => f.question.trim() !== '')
  })

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, authRes, tagRes] = await Promise.all([
          blogService.listCategories(),
          blogService.listAuthors(),
          blogService.listTags()
        ])
        setCategories(catRes.data)
        setAuthors(authRes.data)
        setTags(tagRes.data)
      } catch {
        // silently fail
      }
    }
    loadData()
  }, [])

  // Load existing post
  useEffect(() => {
    if (!editId) return
    const load = async () => {
      try {
        const res = await blogService.getPost(editId)
        const { post, tags: postTags, faqs: postFaqs } = res.data
        setTitle(post.title)
        setSlug(post.slug)
        setSlugManual(true)
        setExcerpt(post.excerpt || '')
        setQuickAnswer(post.quick_answer || '')
        setMetaTitle(post.meta_title || '')
        setMetaDescription(post.meta_description || '')
        setPrimaryKeyword(post.primary_keyword || '')
        setSecondaryKeywords((post.secondary_keywords || []).join(', '))
        setCategoryId(post.category_id)
        setAuthorId(post.author_id)
        setSelectedTags(postTags || [])
        setFeaturedImageUrl(post.featured_image_url || '')
        setCanonicalUrl(post.canonical_url || '')
        setStatus(post.status)
        setFaqs(postFaqs?.map(f => ({ id: f.id, question: f.question, answer: f.answer })) || [])
        if (editor && post.content) {
          editor.commands.setContent(post.content)
        }
      } catch {
        setSnackbar({ open: true, message: 'Failed to load post', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [editId, editor])

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title))
    }
  }, [title, slugManual])

  // Toolbar helpers
  const handleLinkInsert = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  const handleImageInsert = useCallback(() => {
    if (!editor) return
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  // FAQ management
  const addFAQ = () => setFaqs(prev => [...prev, { question: '', answer: '' }])
  const removeFAQ = (index: number) => setFaqs(prev => prev.filter((_, i) => i !== index))
  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  // Save handler
  const handleSave = async (publishAction?: 'draft' | 'publish') => {
    if (!title.trim()) {
      setSnackbar({ open: true, message: 'Title is required', severity: 'error' })
      return
    }
    setSaving(true)
    try {
      const data = editorData
      const secondaryKwArr = secondaryKeywords.split(',').map(s => s.trim()).filter(Boolean)
      const payload: CreatePostRequest = {
        title,
        content: data.json,
        content_html: data.html,
        excerpt,
        featured_image_url: featuredImageUrl,
        author_id: authorId,
        category_id: categoryId,
        status: publishAction || status,
        meta_title: metaTitle,
        meta_description: metaDescription,
        canonical_url: canonicalUrl,
        primary_keyword: primaryKeyword,
        secondary_keywords: secondaryKwArr,
        quick_answer: quickAnswer,
        seo_score: seoResult.score,
        word_count: data.wordCount,
        reading_time_min: Math.max(1, Math.round(data.wordCount / 200)),
        tag_ids: selectedTags.map(t => t.id)
      }

      if (editId) {
        await blogService.updatePost(editId, payload)
      } else {
        await blogService.createPost(payload)
      }

      setSnackbar({ open: true, message: editId ? 'Post updated!' : 'Post created!', severity: 'success' })
      setTimeout(() => router.push('/blog/posts'), 1200)
    } catch {
      setSnackbar({ open: true, message: 'Failed to save post', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Tag creation handler
  const handleTagCreate = async (name: string) => {
    try {
      const res = await blogService.createTag(name)
      const newTag = res.data
      setTags(prev => [...prev, newTag])
      setSelectedTags(prev => [...prev, newTag])
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>
          {editId ? 'Edit Post' : 'New Post'}
        </Typography>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => handleSave('draft')} disabled={saving}>
            Save Draft
          </Button>
          <Button variant="contained" onClick={() => handleSave(editId ? undefined : 'publish')} disabled={saving}>
            {editId ? 'Update' : 'Publish'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* LEFT COLUMN - Editor */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Title */}
          <TextField
            fullWidth
            variant="standard"
            placeholder="Enter post title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            InputProps={{ sx: { fontSize: '2rem', fontWeight: 600 } }}
            sx={{ mb: 1 }}
          />

          {/* Slug */}
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Typography variant="caption" color="text.secondary">Slug:</Typography>
            <TextField
              size="small"
              variant="standard"
              value={slug}
              onChange={e => { setSlugManual(true); setSlug(slugify(e.target.value)) }}
              InputProps={{ sx: { fontSize: '0.8rem' } }}
              sx={{ flex: 1 }}
            />
          </Box>

          {/* Toolbar */}
          <Card variant="outlined" sx={{ mb: 0 }}>
            <Box display="flex" flexWrap="wrap" gap={0.25} p={0.5} borderBottom="1px solid" borderColor="divider">
              <Tooltip title="Bold">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleBold().run()} color={editor?.isActive('bold') ? 'primary' : 'default'}>
                  <i className="tabler-bold" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleItalic().run()} color={editor?.isActive('italic') ? 'primary' : 'default'}>
                  <i className="tabler-italic" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Underline">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleUnderline().run()} color={editor?.isActive('underline') ? 'primary' : 'default'}>
                  <i className="tabler-underline" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Tooltip title="Heading 2">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} color={editor?.isActive('heading', { level: 2 }) ? 'primary' : 'default'}>
                  <i className="tabler-h-2" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Heading 3">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} color={editor?.isActive('heading', { level: 3 }) ? 'primary' : 'default'}>
                  <i className="tabler-h-3" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Tooltip title="Bullet List">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleBulletList().run()} color={editor?.isActive('bulletList') ? 'primary' : 'default'}>
                  <i className="tabler-list" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ordered List">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleOrderedList().run()} color={editor?.isActive('orderedList') ? 'primary' : 'default'}>
                  <i className="tabler-list-numbers" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Blockquote">
                <IconButton size="small" onClick={() => editor?.chain().focus().toggleBlockquote().run()} color={editor?.isActive('blockquote') ? 'primary' : 'default'}>
                  <i className="tabler-blockquote" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Tooltip title="Insert Link">
                <IconButton size="small" onClick={handleLinkInsert}>
                  <i className="tabler-link" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Insert Image">
                <IconButton size="small" onClick={handleImageInsert}>
                  <i className="tabler-photo" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Tooltip title="Undo">
                <IconButton size="small" onClick={() => editor?.chain().focus().undo().run()}>
                  <i className="tabler-arrow-back-up" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Redo">
                <IconButton size="small" onClick={() => editor?.chain().focus().redo().run()}>
                  <i className="tabler-arrow-forward-up" style={{fontSize: 18}} />
                </IconButton>
              </Tooltip>
              <Box flex={1} />
              <Typography variant="caption" color="text.secondary" alignSelf="center" pr={1}>
                {editorData.wordCount} words
              </Typography>
            </Box>

            {/* Editor area */}
            <Box
              sx={{
                '& .ProseMirror': {
                  minHeight: 400,
                  p: 2,
                  outline: 'none',
                  '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 1 },
                  '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
                  '& h4': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
                  '& p': { mb: 1, lineHeight: 1.7 },
                  '& ul, & ol': { pl: 3 },
                  '& blockquote': { borderLeft: '3px solid', borderColor: 'divider', pl: 2, ml: 0, color: 'text.secondary' },
                  '& img': { maxWidth: '100%', borderRadius: 1 },
                  '& a': { color: 'primary.main', textDecoration: 'underline' }
                },
                '& .ProseMirror p.is-editor-empty:first-of-type::before': {
                  content: 'attr(data-placeholder)',
                  float: 'left',
                  color: 'text.disabled',
                  pointerEvents: 'none',
                  height: 0
                }
              }}
            >
              <EditorContent editor={editor} />
            </Box>
          </Card>

          {/* Quick Answer */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Quick Answer (AEO)"
            placeholder="2-3 sentence answer for featured snippets..."
            value={quickAnswer}
            onChange={e => setQuickAnswer(e.target.value)}
            sx={{ mt: 3 }}
          />

          {/* FAQ Section */}
          <Box mt={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" fontWeight={600}>FAQ Section</Typography>
              <Button size="small" startIcon={<i className="tabler-plus" />} onClick={addFAQ}>
                Add FAQ
              </Button>
            </Box>
            {faqs.map((faq, index) => (
              <Card key={index} variant="outlined" sx={{ mb: 1.5 }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box flex={1}>
                      <TextField
                        fullWidth
                        size="small"
                        label={`Question ${index + 1}`}
                        value={faq.question}
                        onChange={e => updateFAQ(index, 'question', e.target.value)}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={2}
                        label="Answer"
                        value={faq.answer}
                        onChange={e => updateFAQ(index, 'answer', e.target.value)}
                      />
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeFAQ(index)} sx={{ mt: 0.5 }}>
                      <i className="tabler-trash" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
            {faqs.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No FAQs added. Click &quot;Add FAQ&quot; to create one.
              </Typography>
            )}
          </Box>

          {/* Excerpt */}
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Excerpt"
            placeholder="A brief summary of the post..."
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            sx={{ mt: 3 }}
          />
        </Grid>

        {/* RIGHT COLUMN - SEO Panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* SEO Score */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>SEO Score</Typography>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <Box position="relative" display="inline-flex">
                  <CircularProgress
                    variant="determinate"
                    value={seoResult.score}
                    size={100}
                    thickness={5}
                    sx={{ color: seoResult.gradeColor }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0, left: 0, bottom: 0, right: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Typography variant="h5" fontWeight={700} sx={{ color: seoResult.gradeColor }}>
                      {seoResult.score}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ color: seoResult.gradeColor }}>
                      {seoResult.grade}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* SEO Checklist */}
              <Divider sx={{ mb: 1.5 }} />
              {seoResult.checks.map(check => (
                <Box key={check.id} display="flex" alignItems="center" gap={1} mb={0.75}>
                  {check.passed ? (
                    <i className="tabler-check" style={{color: "#4caf50"}} />
                  ) : (
                    <i className="tabler-x" style={{color: "#f44336"}} />
                  )}
                  <Typography variant="body2" color={check.passed ? 'text.primary' : 'text.secondary'} sx={{ fontSize: '0.8rem' }}>
                    {check.label}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Meta Fields */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>SEO Meta</Typography>

              <TextField
                fullWidth
                size="small"
                label="Meta Title"
                value={metaTitle}
                onChange={e => setMetaTitle(e.target.value)}
                helperText={`${metaTitle.length}/60 characters`}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                label="Meta Description"
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value)}
                helperText={`${metaDescription.length}/155 characters`}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Primary Keyword"
                value={primaryKeyword}
                onChange={e => setPrimaryKeyword(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                size="small"
                label="Secondary Keywords"
                placeholder="keyword1, keyword2, ..."
                value={secondaryKeywords}
                onChange={e => setSecondaryKeywords(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Taxonomy */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Taxonomy</Typography>

              <TextField
                fullWidth
                size="small"
                select
                label="Category"
                value={categoryId ?? ''}
                onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="">None</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                fullWidth
                size="small"
                select
                label="Author"
                value={authorId ?? ''}
                onChange={e => setAuthorId(e.target.value ? Number(e.target.value) : null)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="">None</MenuItem>
                {authors.map(auth => (
                  <MenuItem key={auth.id} value={auth.id}>{auth.name}</MenuItem>
                ))}
              </TextField>

              <Autocomplete
                multiple
                size="small"
                options={tags}
                value={selectedTags}
                onChange={(_, newValue) => {
                  const filtered = newValue.filter((v): v is BlogTag => typeof v !== 'string')
                  setSelectedTags(filtered)
                }}
                getOptionLabel={opt => typeof opt === 'string' ? opt : opt.name}
                isOptionEqualToValue={(opt, val) => typeof opt !== 'string' && typeof val !== 'string' && opt.id === val.id}
                freeSolo
                renderTags={(value, getTagProps) =>
                  value.map((tag, index) => (
                    <Chip {...getTagProps({ index })} key={tag.id} label={tag.name} size="small" />
                  ))
                }
                renderInput={params => <TextField {...params} label="Tags" placeholder="Add tags..." />}
                onInputChange={(_, value, reason) => {
                  if (reason === 'reset') return
                }}
                filterOptions={(options, state) => {
                  const filtered = options.filter(o => o.name.toLowerCase().includes(state.inputValue.toLowerCase()))
                  if (state.inputValue.trim() && !filtered.some(o => o.name.toLowerCase() === state.inputValue.toLowerCase())) {
                    filtered.push({ id: -1, account_id: 0, name: state.inputValue.trim(), slug: '', created_at: '' } as BlogTag)
                  }
                  return filtered
                }}
                onClose={(_, reason) => {
                  if (reason === 'selectOption') {
                    const last = selectedTags[selectedTags.length - 1]
                    if (last && last.id === -1) {
                      setSelectedTags(prev => prev.filter(t => t.id !== -1))
                      handleTagCreate(last.name)
                    }
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Media & URLs */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>Media & URLs</Typography>

              <TextField
                fullWidth
                size="small"
                label="Featured Image URL"
                placeholder="https://..."
                value={featuredImageUrl}
                onChange={e => setFeaturedImageUrl(e.target.value)}
                sx={{ mb: 2 }}
              />
              {featuredImageUrl && (
                <Box mb={2} borderRadius={1} overflow="hidden" border="1px solid" borderColor="divider">
                  <Box component="img" src={featuredImageUrl} alt="Featured" sx={{ width: '100%', display: 'block' }} />
                </Box>
              )}

              <TextField
                fullWidth
                size="small"
                label="Canonical URL"
                placeholder="https://..."
                value={canonicalUrl}
                onChange={e => setCanonicalUrl(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Status & Actions */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>Status</Typography>
              <Chip
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                color={status === 'published' ? 'success' : status === 'draft' ? 'default' : 'warning'}
                size="small"
                sx={{ mb: 2 }}
              />
              <Box display="flex" flexDirection="column" gap={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => handleSave('draft')}
                  disabled={saving}
                >
                  Save Draft
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => handleSave(editId ? undefined : 'publish')}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={20} /> : editId ? 'Update Post' : 'Publish'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
