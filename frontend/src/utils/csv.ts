/**
 * RFC-4180-style CSV parser.
 *
 * Correctly handles the cases a naive `text.split('\n')` + `line.split(',')` gets wrong:
 *  - quoted fields containing the delimiter:  "vip,investor"
 *  - quoted fields containing newlines:        "line1\nline2"
 *  - escaped quotes inside quoted fields:       "she said ""hi"""
 *  - CRLF / CR / LF line endings
 *
 * Returns an array of rows, each an array of raw cell strings (surrounding CSV quotes removed,
 * inner content preserved verbatim — callers trim if they want). Fully-empty rows are dropped.
 */
export function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n?/g, '\n') // normalise CRLF / lone CR to LF

  for (let i = 0; i < s.length; i++) {
    const c = s[i]

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"' // "" -> literal quote
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }

  // Flush the final field/row (file may not end with a newline)
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

/**
 * De-duplicate header names so columns sharing a name don't silently overwrite each other when
 * building row objects keyed by header. Duplicates get a numeric suffix: name, name_2, name_3…
 * Empty headers become "column", "column_2", …
 */
export function dedupeHeaders(headers: string[]): string[] {
  const seen: Record<string, number> = {}

  return headers.map(h => {
    const base = (h || 'column').trim() || 'column'

    if (seen[base] === undefined) {
      seen[base] = 0

      return base
    }

    seen[base] += 1

    return `${base}_${seen[base] + 1}`
  })
}
