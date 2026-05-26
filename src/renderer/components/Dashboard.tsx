import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { VaultStats, RecentFile } from '../../shared/types'

interface DashboardProps {
  vaultPath: string
  onFileClick: (filePath: string) => void
  onNewNote: () => void
}

// ─── Utility helpers ───────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(ts).toLocaleDateString()
}

function getWeekdayLabel(i: number): string {
  return ['', 'Mon', '', 'Wed', '', 'Fri', ''][i]
}

function getMonthLabel(date: Date): string {
  return date.toLocaleString('default', { month: 'short' })
}

// ─── Activity Heatmap (GitHub-style) ────────────────────────────────

function ActivityHeatmap({ dailyModified }: { dailyModified: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Build 52 weeks of data
  const { weeks, maxCount, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayDay = today.getDay() // 0=Sun
    // Start from 52 weeks ago, on Sunday
    const start = new Date(today)
    start.setDate(start.getDate() - (52 * 7 + todayDay))

    const weeks: { date: string; count: number; dayOfWeek: number }[][] = []
    let max = 0
    const monthLabels: { label: string; weekIdx: number }[] = []
    let lastMonth = -1

    let d = new Date(start)
    let weekArr: { date: string; count: number; dayOfWeek: number }[] = []

    while (d <= today) {
      const key = d.toISOString().slice(0, 10)
      const count = dailyModified[key] || 0
      if (count > max) max = count

      const month = d.getMonth()
      if (month !== lastMonth && weekArr.length === 0) {
        monthLabels.push({ label: getMonthLabel(d), weekIdx: weeks.length })
        lastMonth = month
      }

      weekArr.push({ date: key, count, dayOfWeek: d.getDay() })

      if (d.getDay() === 6 || d.getTime() === today.getTime()) {
        weeks.push(weekArr)
        weekArr = []
      }

      d = new Date(d.getTime() + 86400000)
    }
    if (weekArr.length > 0) weeks.push(weekArr)

    return { weeks, maxCount: max, monthLabels }
  }, [dailyModified])

  const cellSize = 13
  const cellGap = 3
  const leftPad = 32
  const topPad = 20

  const width = leftPad + weeks.length * (cellSize + cellGap)
  const height = topPad + 7 * (cellSize + cellGap)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Month labels
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (const ml of monthLabels) {
      ctx.fillText(ml.label, leftPad + ml.weekIdx * (cellSize + cellGap), 12)
    }

    // Day labels
    for (let i = 0; i < 7; i++) {
      const label = getWeekdayLabel(i)
      if (label) {
        ctx.fillText(label, 2, topPad + i * (cellSize + cellGap) + 10)
      }
    }

    // Cells
    for (let w = 0; w < weeks.length; w++) {
      for (const cell of weeks[w]) {
        const x = leftPad + w * (cellSize + cellGap)
        const y = topPad + cell.dayOfWeek * (cellSize + cellGap)
        const intensity = maxCount > 0 ? cell.count / maxCount : 0

        let fill: string
        if (cell.count === 0) {
          fill = 'rgba(255,255,255,0.04)'
        } else if (intensity < 0.25) {
          fill = 'rgba(94,158,255,0.2)'
        } else if (intensity < 0.5) {
          fill = 'rgba(94,158,255,0.4)'
        } else if (intensity < 0.75) {
          fill = 'rgba(94,158,255,0.6)'
        } else {
          fill = 'rgba(94,158,255,0.85)'
        }

        ctx.beginPath()
        ctx.roundRect(x, y, cellSize, cellSize, 2)
        ctx.fillStyle = fill
        ctx.fill()
      }
    }
  }, [weeks, maxCount, monthLabels, width, height])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      for (let w = 0; w < weeks.length; w++) {
        for (const cell of weeks[w]) {
          const x = leftPad + w * (cellSize + cellGap)
          const y = topPad + cell.dayOfWeek * (cellSize + cellGap)
          if (mx >= x && mx <= x + cellSize && my >= y && my <= y + cellSize) {
            setTooltip({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top - 30,
              text: `${cell.count} note${cell.count !== 1 ? 's' : ''} on ${cell.date}`
            })
            return
          }
        }
      }
      setTooltip(null)
    },
    [weeks]
  )

  return (
    <div className="dash-heatmap-wrap" style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          ref={tooltipRef}
          className="dash-heatmap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="dash-heatmap-legend">
        <span>Less</span>
        <span className="dash-legend-cell" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <span className="dash-legend-cell" style={{ background: 'rgba(94,158,255,0.2)' }} />
        <span className="dash-legend-cell" style={{ background: 'rgba(94,158,255,0.4)' }} />
        <span className="dash-legend-cell" style={{ background: 'rgba(94,158,255,0.6)' }} />
        <span className="dash-legend-cell" style={{ background: 'rgba(94,158,255,0.85)' }} />
        <span>More</span>
      </div>
    </div>
  )
}

// ─── Weekly Bar Chart ────────────────────────────────────────────────

function WeeklyBarChart({ dailyCreated }: { dailyCreated: Record<string, number> }) {
  // Last 12 weeks of note creation
  const bars = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const result: { label: string; count: number }[] = []

    for (let w = 11; w >= 0; w--) {
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() - w * 7)
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 6)

      let count = 0
      const d = new Date(weekStart)
      while (d <= weekEnd) {
        const key = d.toISOString().slice(0, 10)
        count += dailyCreated[key] || 0
        d.setDate(d.getDate() + 1)
      }

      const label =
        weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' })
      result.push({ label, count })
    }
    return result
  }, [dailyCreated])

  const maxVal = Math.max(...bars.map((b) => b.count), 1)

  return (
    <div className="dash-bar-chart">
      <div className="dash-bars">
        {bars.map((bar, i) => (
          <div key={i} className="dash-bar-col">
            <div className="dash-bar-value">{bar.count || ''}</div>
            <div className="dash-bar-track">
              <div
                className="dash-bar-fill"
                style={{ height: `${(bar.count / maxVal) * 100}%` }}
              />
            </div>
            <div className="dash-bar-label">{i % 2 === 0 ? bar.label : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tag Cloud ───────────────────────────────────────────────────────

function TagCloud({ tagCounts }: { tagCounts: { tag: string; count: number }[] }) {
  const top = tagCounts.slice(0, 30)
  const maxCount = top.length > 0 ? top[0].count : 1

  return (
    <div className="dash-tag-cloud">
      {top.map((t) => {
        const scale = 0.6 + (t.count / maxCount) * 0.6
        const opacity = 0.4 + (t.count / maxCount) * 0.6
        return (
          <span
            key={t.tag}
            className="dash-tag-pill"
            style={{
              fontSize: `${scale}em`,
              opacity
            }}
            title={`${t.count} note${t.count !== 1 ? 's' : ''}`}
          >
            #{t.tag}
            <span className="dash-tag-count">{t.count}</span>
          </span>
        )
      })}
      {top.length === 0 && (
        <span className="dash-empty-hint">No tags found in your vault yet</span>
      )}
    </div>
  )
}

// ─── Largest Notes ──────────────────────────────────────────────────

function LargestNotes({
  files,
  onFileClick
}: {
  files: VaultStats['files']
  onFileClick: (path: string) => void
}) {
  const top = useMemo(
    () => [...files].sort((a, b) => b.words - a.words).slice(0, 8),
    [files]
  )
  const maxWords = top.length > 0 ? top[0].words : 1

  return (
    <div className="dash-largest-notes">
      {top.map((f) => (
        <button
          key={f.path}
          className="dash-largest-row"
          onClick={() => onFileClick(f.path)}
        >
          <span className="dash-largest-name">{f.name}</span>
          <div className="dash-largest-bar-track">
            <div
              className="dash-largest-bar-fill"
              style={{ width: `${(f.words / maxWords) * 100}%` }}
            />
          </div>
          <span className="dash-largest-count">{formatNumber(f.words)}w</span>
        </button>
      ))}
    </div>
  )
}

// ─── Recent Notes List ──────────────────────────────────────────────

function RecentNotes({
  recentFiles,
  onFileClick
}: {
  recentFiles: RecentFile[]
  onFileClick: (path: string) => void
}) {
  return (
    <div className="dash-recent-list">
      {recentFiles.map((file) => (
        <button
          key={file.path}
          className="dash-recent-item"
          onClick={() => onFileClick(file.path)}
        >
          <svg className="dash-recent-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 1.5h5.586a1 1 0 01.707.293l2.914 2.914a1 1 0 01.293.707V13.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-11a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <span className="dash-recent-name">{file.name}</span>
          <span className="dash-recent-time">{formatRelative(file.openedAt)}</span>
        </button>
      ))}
      {recentFiles.length === 0 && (
        <span className="dash-empty-hint">No recently opened notes</span>
      )}
    </div>
  )
}

// ─── Velocity Streak ────────────────────────────────────────────────

function calcStreak(dailyModified: Record<string, number>): number {
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(today)

  // Allow today to be missing (streak still counts if yesterday had activity)
  const todayKey = d.toISOString().slice(0, 10)
  if (!dailyModified[todayKey]) {
    d.setDate(d.getDate() - 1)
  }

  while (true) {
    const key = d.toISOString().slice(0, 10)
    if (dailyModified[key]) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// ─── Main Dashboard ─────────────────────────────────────────────────

export function Dashboard({ vaultPath, onFileClick, onNewNote }: DashboardProps) {
  const [stats, setStats] = useState<VaultStats | null>(null)
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.getVaultStats(vaultPath),
      window.api.getRecentFiles()
    ]).then(([s, r]) => {
      setStats(s)
      setRecentFiles(r)
      setLoading(false)
    })
  }, [vaultPath])

  const streak = useMemo(
    () => (stats ? calcStreak(stats.dailyModified) : 0),
    [stats]
  )

  const avgWordsPerNote = useMemo(
    () => (stats && stats.totalNotes > 0 ? Math.round(stats.totalWords / stats.totalNotes) : 0),
    [stats]
  )

  const notesThisWeek = useMemo(() => {
    if (!stats) return 0
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    return stats.files.filter((f) => f.createdAt >= weekAgo).length
  }, [stats])

  if (loading || !stats) {
    return (
      <div className="dashboard">
        <div className="dash-loading">
          <div className="dash-loading-spinner" />
          <span>Analyzing your vault...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dash-scroll">
        {/* Header */}
        <div className="dash-header">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-subtitle">
              {vaultPath.split('/').pop()} &middot; {stats.totalNotes} notes
            </p>
          </div>
          <button className="dash-new-note-btn" onClick={onNewNote}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Note
          </button>
        </div>

        {/* Stat cards */}
        <div className="dash-stats-row">
          <div className="dash-stat-card">
            <span className="dash-stat-value">{formatNumber(stats.totalNotes)}</span>
            <span className="dash-stat-label">Notes</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-value">{formatNumber(stats.totalWords)}</span>
            <span className="dash-stat-label">Words</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-value">{avgWordsPerNote}</span>
            <span className="dash-stat-label">Avg Words/Note</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-value">{stats.totalFolders}</span>
            <span className="dash-stat-label">Folders</span>
          </div>
          <div className="dash-stat-card dash-stat-accent">
            <span className="dash-stat-value">{streak}</span>
            <span className="dash-stat-label">Day Streak</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-value">{notesThisWeek}</span>
            <span className="dash-stat-label">This Week</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="dash-grid">
          {/* Left column */}
          <div className="dash-col">
            {/* Activity heatmap */}
            <div className="dash-card dash-card-wide">
              <h3 className="dash-card-title">Activity</h3>
              <p className="dash-card-desc">Notes modified per day, last 52 weeks</p>
              <ActivityHeatmap dailyModified={stats.dailyModified} />
            </div>

            {/* Weekly velocity */}
            <div className="dash-card">
              <h3 className="dash-card-title">Creation Velocity</h3>
              <p className="dash-card-desc">Notes created per week</p>
              <WeeklyBarChart dailyCreated={stats.dailyCreated} />
            </div>

            {/* Largest notes */}
            <div className="dash-card">
              <h3 className="dash-card-title">Largest Notes</h3>
              <p className="dash-card-desc">By word count</p>
              <LargestNotes files={stats.files} onFileClick={onFileClick} />
            </div>
          </div>

          {/* Right column */}
          <div className="dash-col dash-col-narrow">
            {/* Recent notes */}
            <div className="dash-card">
              <h3 className="dash-card-title">Recent Notes</h3>
              <RecentNotes recentFiles={recentFiles} onFileClick={onFileClick} />
            </div>

            {/* Tag cloud */}
            <div className="dash-card">
              <h3 className="dash-card-title">Tags</h3>
              <p className="dash-card-desc">{stats.tagCounts.length} unique tags</p>
              <TagCloud tagCounts={stats.tagCounts} />
            </div>

            {/* Quick actions */}
            <div className="dash-card">
              <h3 className="dash-card-title">Quick Actions</h3>
              <div className="dash-shortcuts">
                <div className="dash-shortcut"><kbd>Cmd+N</kbd><span>New note</span></div>
                <div className="dash-shortcut"><kbd>Cmd+K</kbd><span>Quick switcher</span></div>
                <div className="dash-shortcut"><kbd>Cmd+Shift+F</kbd><span>Search vault</span></div>
                <div className="dash-shortcut"><kbd>Cmd+G</kbd><span>Graph view</span></div>
                <div className="dash-shortcut"><kbd>Cmd+E</kbd><span>Cycle view</span></div>
                <div className="dash-shortcut"><kbd>Cmd+\</kbd><span>Toggle sidebar</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
