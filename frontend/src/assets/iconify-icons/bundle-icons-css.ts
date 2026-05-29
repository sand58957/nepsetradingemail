/**
 * This is an advanced example for creating icon bundles for Iconify SVG Framework.
 *
 * It creates a bundle from:
 * - All SVG files in a directory.
 * - Custom JSON files.
 * - Iconify icon sets.
 * - SVG framework.
 *
 * This example uses Iconify Tools to import and clean up icons.
 * For Iconify Tools documentation visit https://docs.iconify.design/tools/tools2/
 */
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Installation: npm install --save-dev @iconify/tools @iconify/utils @iconify/json @iconify/iconify
import { cleanupSVG, importDirectory, isEmptyColor, parseColors, runSVGO } from '@iconify/tools'
import type { IconifyJSON } from '@iconify/types'
import { getIcons, getIconsCSS, stringToIcon } from '@iconify/utils'

const require = createRequire(import.meta.url)

async function generateIconsCSS() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  /**
   * Script configuration
   */
  interface BundleScriptCustomSVGConfig {
    // eslint-disable-next-line lines-around-comment
    // Path to SVG files
    dir: string

    // True if icons should be treated as monotone: colors replaced with currentColor
    monotone: boolean

    // Icon set prefix
    prefix: string
  }

  interface BundleScriptCustomJSONConfig {
    // eslint-disable-next-line lines-around-comment
    // Path to JSON file
    filename: string

    // List of icons to import. If missing, all icons will be imported
    icons?: string[]
  }

  interface BundleScriptConfig {
    // eslint-disable-next-line lines-around-comment
    // Custom SVG to import and bundle
    svg?: BundleScriptCustomSVGConfig[]

    // Icons to bundled from @iconify/json packages
    icons?: string[]

    // List of JSON files to bundled
    // Entry can be a string, pointing to filename or a BundleScriptCustomJSONConfig object (see type above)
    // If entry is a string or object without 'icons' property, an entire JSON file will be bundled
    json?: (string | BundleScriptCustomJSONConfig)[]
  }

  const sources: BundleScriptConfig = {
    json: [
      // Bundle ONLY the tabler icons actually used in the app. Bundling the full
      // ~6000-icon set produced a 2.7 MB render-blocking CSS file. Regenerate this
      // list with: grep -rhoE 'tabler-[a-z0-9-]+' src | sort -u  (strip the prefix).
      {
        filename: require.resolve('@iconify/json/json/tabler.json'),
        icons: [
        'ab', 'ad', 'address-book', 'alert-circle', 'alert-octagon', 'alert-triangle',
        'alert-triangle-filled', 'align-box-bottom-center', 'align-center', 'align-justified', 'align-left', 'align-right',
        'arrow-back-up', 'arrow-down', 'arrow-forward-up', 'arrow-left', 'arrow-right', 'arrow-up',
        'arrows-move', 'arrows-move-vertical', 'article', 'atom', 'ban', 'bell',
        'bell-ringing', 'blockquote', 'bold', 'book', 'book-2', 'bookmark',
        'bookmarks', 'books', 'bounce-right', 'box', 'brand-android', 'brand-angular',
        'brand-apple', 'brand-aws', 'brand-dribbble', 'brand-facebook', 'brand-facebook-filled', 'brand-facebook-messenger',
        'brand-github-filled', 'brand-google', 'brand-google-drive', 'brand-google-filled', 'brand-google-play', 'brand-instagram',
        'brand-linkedin', 'brand-messenger', 'brand-paypal', 'brand-react-native', 'brand-sendgrid', 'brand-telegram',
        'brand-twitter', 'brand-twitter-filled', 'brand-whatsapp', 'brand-windows', 'brand-x', 'briefcase',
        'browser-check', 'building', 'building-skyscraper', 'building-store', 'bulb', 'calendar',
        'calendar-check', 'calendar-event', 'calendar-month', 'calendar-plus', 'calendar-stats', 'camera',
        'car', 'cards', 'category', 'chart-bar', 'chart-donut-2', 'chart-donut-3',
        'chart-dots-3', 'chart-histogram', 'chart-pie', 'chart-pie-2', 'chart-ppf', 'chart-sankey',
        'check', 'checkbox', 'checks', 'checkup-list', 'chevron', 'chevron-down',
        'chevron-left', 'chevron-right', 'chevron-right-pipe', 'chevron-up', 'circle', 'circle-arrow-down',
        'circle-arrow-up', 'circle-check', 'circle-check-filled', 'circle-dot', 'circle-filled', 'circle-off',
        'circle-plus', 'circle-x', 'circle-x-filled', 'click', 'clock', 'clock-hour-3',
        'cloud', 'cloud-off', 'cloud-upload', 'code', 'coin', 'color-picker',
        'color-swatch', 'columns', 'confetti', 'copy', 'corner-down-left', 'corner-left-down',
        'corner-right-down', 'cpu', 'credit-card', 'credit-card-filled', 'crown', 'currency-dollar',
        'database', 'database-off', 'device-desktop', 'device-desktop-analytics', 'device-floppy', 'device-gamepad-2',
        'device-imac-dollar', 'device-ipad-horizontal-plus', 'device-laptop', 'device-mobile', 'devices', 'diamond',
        'diamond-filled', 'discount', 'discount-2', 'discount-check-filled', 'dots', 'dots-vertical',
        'download', 'edit', 'external-link', 'eye', 'eye-off', 'file',
        'file-alert', 'file-analytics', 'file-check', 'file-description', 'file-dollar', 'file-import',
        'file-info', 'file-invoice', 'file-pencil', 'file-plus', 'file-spreadsheet', 'file-text',
        'file-type-pdf', 'file-upload', 'files', 'filter', 'flag', 'flask',
        'fold', 'folder', 'folder-plus', 'folders', 'forms', 'free-rights',
        'gif', 'gift', 'git-fork', 'git-merge', 'globe', 'h-2',
        'h-3', 'hand-wave', 'headphones', 'headset', 'heart', 'help',
        'help-circle', 'history', 'home', 'icons', 'id', 'inbox',
        'infinity', 'info-circle', 'italic', 'key', 'language', 'layout',
        'layout-board-split', 'layout-bottombar', 'layout-dashboard', 'layout-grid', 'layout-grid-add', 'layout-navbar',
        'letter-d', 'letter-h', 'letter-n', 'lifebuoy', 'line', 'link',
        'list', 'list-check', 'list-details', 'list-numbers', 'list-search', 'loader-2',
        'lock', 'lock-check', 'lock-open', 'lock-plus', 'login', 'login-2',
        'logout', 'mail', 'mail-check', 'mail-forward', 'mail-opened', 'map',
        'map-pin', 'markdown', 'menu-2', 'message', 'message-2', 'message-circle',
        'message-circle-2', 'message-dots', 'message-star', 'messages', 'microphone', 'microphone-2',
        'minus', 'mood-happy', 'mood-smile', 'moon-stars', 'mouse', 'music',
        'news', 'notification', 'oval-vertical', 'package', 'palette', 'paperclip',
        'pencil', 'percentage', 'phone', 'phone-call', 'photo', 'pig',
        'player-pause', 'player-play', 'player-play-filled', 'playlist-add', 'plug-connected', 'plus',
        'plus-minus', 'progress', 'qrcode', 'quote', 'receipt', 'rectangle',
        'refresh', 'replace', 'robot', 'rocket', 'rotate-clockwise-2', 'rss',
        'school', 'search', 'search-off', 'send', 'send-2', 'seo',
        'server', 'server-cog', 'settings', 'settings-2', 'settings-automation', 'settings-cog',
        'shadow', 'share', 'shield', 'shield-check', 'shield-lock', 'ship',
        'shirt', 'shoe', 'shopping-cart', 'shopping-cart-check', 'sitemap', 'smart-home',
        'sparkles', 'speakerphone', 'square', 'square-plus', 'star', 'star-filled',
        'strikethrough', 'sun', 'svg', 'switch-horizontal', 'table', 'table-plus',
        'tag', 'tags', 'template', 'test-pipe', 'text-wrap', 'thumb-up',
        'thumb-up-filled', 'ticket', 'timeline', 'toggle-left', 'toggle-right', 'trash',
        'trending-up', 'truck', 'truck-delivery', 'typography', 'underline', 'upload',
        'user', 'user-cancel', 'user-check', 'user-circle', 'user-edit', 'user-minus',
        'user-off', 'user-plus', 'user-question', 'user-search', 'user-shield', 'user-square',
        'user-x', 'users', 'users-group', 'users-plus', 'variable', 'video',
        'wallet', 'webhook', 'world', 'x'
        ]
      }
    ],

    icons: [
      'bx-basket',
      'bi-airplane-engines',
      'ri-anchor-line',
      'uit-adobe-alt',

      // 'fa6-regular-comment',
      'twemoji-auto-rickshaw'
    ],

    svg: [
      /* {
        dir: 'src/assets/iconify-icons/svg',
        monotone: false,
        prefix: 'custom'
      } */
      /* {
      dir: 'src/assets/iconify-icons/emojis',
      monotone: false,
      prefix: 'emoji'
    } */
    ]
  }

  // File to save bundle to
  const target = join(__dirname, 'generated-icons.css')

  /**
   * Do stuff!
   */

  // Create directory for output if missing
  const dir = dirname(target)

  try {
    await fs.mkdir(dir, {
      recursive: true
    })
  } catch {
    //
  }

  const allIcons: IconifyJSON[] = []

  /**
   * Convert sources.icons to sources.json
   */
  if (sources.icons) {
    const sourcesJSON = sources.json ? sources.json : (sources.json = [])

    // Sort icons by prefix
    const organizedList = organizeIconsList(sources.icons)

    for (const prefix in organizedList) {
      const filename = require.resolve(`@iconify/json/json/${prefix}.json`)

      sourcesJSON.push({
        filename,
        icons: organizedList[prefix]
      })
    }
  }

  /**
   * Bundle JSON files and collect icons
   */
  if (sources.json) {
    for (let i = 0; i < sources.json.length; i++) {
      const item = sources.json[i]

      // Load icon set
      const filename = typeof item === 'string' ? item : item.filename
      const content = JSON.parse(await fs.readFile(filename, 'utf8')) as IconifyJSON

      // Filter icons
      if (typeof item !== 'string' && item.icons?.length) {
        const filteredContent = getIcons(content, item.icons)

        if (!filteredContent) throw new Error(`Cannot find required icons in ${filename}`)

        // Collect filtered icons
        allIcons.push(filteredContent)
      } else {
        // Collect all icons from the JSON file
        allIcons.push(content)
      }
    }
  }

  /**
   * Bundle custom SVG icons and collect icons
   */
  if (sources.svg) {
    for (let i = 0; i < sources.svg.length; i++) {
      const source = sources.svg[i]

      // Import icons
      const iconSet = await importDirectory(source.dir, {
        prefix: source.prefix
      })

      // Validate, clean up, fix palette, etc.
      await iconSet.forEach(async (name, type) => {
        if (type !== 'icon') return

        // Get SVG instance for parsing
        const svg = iconSet.toSVG(name)

        if (!svg) {
          // Invalid icon
          iconSet.remove(name)

          return
        }

        // Clean up and optimise icons
        try {
          // Clean up icon code
          await cleanupSVG(svg)

          if (source.monotone) {
            // Replace color with currentColor, add if missing
            // If icon is not monotone, remove this code
            await parseColors(svg, {
              defaultColor: 'currentColor',
              callback: (attr, colorStr, color) => {
                return !color || isEmptyColor(color) ? colorStr : 'currentColor'
              }
            })
          }

          // Optimise
          await runSVGO(svg)
        } catch (err) {
          // Invalid icon
          console.error(`Error parsing ${name} from ${source.dir}:`, err)
          iconSet.remove(name)

          return
        }

        // Update icon from SVG instance
        iconSet.fromSVG(name, svg)
      })

      // Collect the SVG icon
      allIcons.push(iconSet.export())
    }
  }

  // Generate CSS from collected icons
  const cssContent = allIcons
    .map(iconSet => getIconsCSS(iconSet, Object.keys(iconSet.icons), { iconSelector: '.{prefix}-{name}' }))
    .join('\n')

  // Save the CSS to a file
  await fs.writeFile(target, cssContent, 'utf8')

  console.log(`Saved CSS to ${target}!`)
}

generateIconsCSS().catch(err => {
  console.error(err)
})

/**
 * Sort icon names by prefix
 */
function organizeIconsList(icons: string[]): Record<string, string[]> {
  const sorted: Record<string, string[]> = Object.create(null)

  icons.forEach(icon => {
    const item = stringToIcon(icon)

    if (!item) return

    const prefix = item.prefix
    const prefixList = sorted[prefix] ? sorted[prefix] : (sorted[prefix] = [])

    const name = item.name

    if (!prefixList.includes(name)) prefixList.push(name)
  })

  return sorted
}
