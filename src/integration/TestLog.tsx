import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { on } from './bus'

type SpeechEvent = { text: string; t: number }
type Rating = 'Correct' | 'Wrong' | 'Skip' | null
type TestLogRow = { id: string; time: string; text: string; rating: Rating }

const STORAGE_KEY = 'naviable_log_testlog_v1'

const actionButtonStyle: CSSProperties = {
  minHeight: 48,
  padding: '0.65rem 0.9rem',
  border: '1px solid var(--cyan-400)',
  borderRadius: '0.75rem',
  color: 'var(--cyan-400)',
  background: 'var(--navy-900)',
  cursor: 'pointer',
}

function isTestLogRow(value: unknown): value is TestLogRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<TestLogRow>
  return typeof row.id === 'string'
    && typeof row.time === 'string'
    && !Number.isNaN(Date.parse(row.time))
    && typeof row.text === 'string'
    && (row.rating === null || row.rating === 'Correct' || row.rating === 'Wrong' || row.rating === 'Skip')
}

function readStoredRows(): TestLogRow[] {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (!serialized) return []
    const parsed: unknown = JSON.parse(serialized)
    return Array.isArray(parsed) ? parsed.filter(isTestLogRow) : []
  } catch {
    return []
  }
}

function writeStoredRows(rows: TestLogRow[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
    return true
  } catch {
    return false
  }
}

function removeStoredRows(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export default function TestLog() {
  const [enabled, setEnabled] = useState(false)
  const [rows, setRows] = useState<TestLogRow[]>(readStoredRows)
  const [statusMessage, setStatusMessage] = useState('')
  const rowsRef = useRef(rows)
  const nextRowId = useRef(0)

  useEffect(() => {
    if (!enabled) return

    return on<SpeechEvent>('speech', (event) => {
      if (!event || typeof event.text !== 'string' || !Number.isFinite(event.t)) return

      const nextRows = [
        ...rowsRef.current,
        {
          id: `${event.t}-${nextRowId.current++}`,
          time: new Date().toISOString(),
          text: event.text,
          rating: null,
        },
      ]
      rowsRef.current = nextRows
      setRows(nextRows)
      if (!writeStoredRows(nextRows)) {
        setStatusMessage('Could not save the test log in this browser.')
      }
    })
  }, [enabled])

  const ratedRows = rows.filter((row) => row.rating === 'Correct' || row.rating === 'Wrong')
  const correctRows = ratedRows.filter((row) => row.rating === 'Correct')
  const summary = ratedRows.length === 0
    ? 'Not measured yet'
    : `Correct ${correctRows.length} of ${ratedRows.length}`

  function updateRating(id: string, rating: Exclude<Rating, null>) {
    const nextRows = rowsRef.current.map((row) => row.id === id ? { ...row, rating } : row)
    rowsRef.current = nextRows
    setRows(nextRows)
    if (enabled && !writeStoredRows(nextRows)) {
      setStatusMessage('Could not save the test log in this browser.')
    }
  }

  function exportCsv() {
    const csvRows = [
      ['time', 'text', 'rating'],
      ...rows.map((row) => [row.time, row.text, row.rating ?? '']),
    ]
    const csv = csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'naviable-test-log.csv'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function clearLog() {
    rowsRef.current = []
    setRows([])
    setStatusMessage(removeStoredRows()
      ? 'Test log cleared from this device.'
      : 'Could not clear the saved test log from this browser.')
  }

  return (
    <details className="glass-card p-4 mt-4">
      <summary className="cursor-pointer font-semibold" style={{ color: 'var(--cyan-400)' }}>
        Test log
      </summary>
      <div className="mt-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ accentColor: 'var(--cyan-400)', marginTop: '0.25rem' }}
          />
          <span>Save test log on this device</span>
        </label>
        <p className="text-sm" style={{ opacity: 0.8 }}>
          When enabled, spoken text is stored on this device; camera images are never stored.
        </p>
        <p className="text-sm" aria-label="Test log summary">{summary}</p>
        <p className="text-sm" style={{ opacity: 0.8 }}>Use only in a supervised evaluation with participant consent.</p>

        {rows.length === 0 ? (
          <p className="text-sm" style={{ opacity: 0.8 }}>No speech events have been logged yet.</p>
        ) : (
          <ol className="space-y-3" aria-label="Spoken text log">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl p-3" style={{ border: '1px solid var(--navy-700)' }}>
                <time className="text-xs" dateTime={row.time} style={{ color: 'var(--cyan-400)' }}>
                  {new Date(row.time).toLocaleString()}
                </time>
                <p className="my-2 break-words">{row.text}</p>
                <div className="flex flex-wrap gap-2" aria-label="Rate this spoken text">
                  {(['Correct', 'Wrong', 'Skip'] as const).map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-pressed={row.rating === rating}
                      onClick={() => updateRating(row.id, rating)}
                      style={{
                        ...actionButtonStyle,
                        background: row.rating === rating ? 'var(--navy-700)' : 'var(--navy-900)',
                      }}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} style={actionButtonStyle}>
            Export CSV
          </button>
          <button type="button" onClick={clearLog} style={actionButtonStyle}>
            Clear log
          </button>
        </div>
        <p className="text-sm" role="status" aria-live="polite">{statusMessage}</p>
      </div>
    </details>
  )
}
