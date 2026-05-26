import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum
} from 'd3-force'
import { GraphData, GraphNode, GraphLink } from '../../../shared/types'

// ─── Types for the simulation ─────────────────────────────

interface SimNode extends SimulationNodeDatum {
  id: string
  name: string
  path: string
  tags: string[]
  linkCount: number
  // added by d3
  x?: number
  y?: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  type: 'wiki' | 'markdown' | 'tag'
}

// ─── Props ────────────────────────────────────────────────

interface GraphViewProps {
  graphData: GraphData | null
  loading: boolean
  filter: string
  onNodeClick: (filePath: string) => void
}

// ─── Constants ────────────────────────────────────────────

const LINK_COLORS: Record<string, string> = {
  wiki: '#5e9eff',
  markdown: '#4ec9b0',
  tag: 'rgba(255,255,255,0.06)'
}

const NODE_COLOR = '#5e9eff'
const NODE_COLOR_DIM = 'rgba(94,158,255,0.12)'
const NODE_COLOR_HIGHLIGHT = '#7ab4ff'
const LABEL_COLOR = '#e5e5e7'
const LABEL_COLOR_DIM = 'rgba(229,229,231,0.12)'
const BG_COLOR = '#0d0d0d'

// ─── Component ────────────────────────────────────────────

export function GraphView({ graphData, loading, filter, onNodeClick }: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const matchingIdsRef = useRef<Set<string> | null>(null)

  // Pan and zoom state
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    node: SimNode | null
  }>({ active: false, startX: 0, startY: 0, node: null })

  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null)

  // Compute which nodes match the filter
  useEffect(() => {
    if (!filter.trim() || !graphData) {
      matchingIdsRef.current = null
      return
    }
    const lower = filter.toLowerCase()
    const matching = new Set<string>()
    for (const node of graphData.nodes) {
      if (node.name.toLowerCase().includes(lower)) {
        matching.add(node.id)
      } else if (node.tags.some((t) => t.includes(lower))) {
        matching.add(node.id)
      }
    }
    // Also include neighbors of matching nodes
    for (const link of graphData.links) {
      if (matching.has(link.source) || matching.has(link.target)) {
        matching.add(link.source)
        matching.add(link.target)
      }
    }
    matchingIdsRef.current = matching
  }, [filter, graphData])

  // Screen-space to graph-space transform
  const screenToGraph = useCallback((sx: number, sy: number) => {
    const t = transformRef.current
    return {
      x: (sx - t.x) / t.k,
      y: (sy - t.y) / t.k
    }
  }, [])

  // Find node at position
  const nodeAtPosition = useCallback((gx: number, gy: number): SimNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const node = nodesRef.current[i]
      const nx = node.x ?? 0
      const ny = node.y ?? 0
      const r = Math.max(3, Math.min(12, 3 + (node.linkCount || 0) * 1.5))
      const dx = gx - nx
      const dy = gy - ny
      if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
        return node
      }
    }
    return null
  }, [])

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const t = transformRef.current
    const matching = matchingIdsRef.current
    const hovered = hoveredNode

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)

    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.scale(t.k, t.k)

    // Draw links
    for (const link of linksRef.current) {
      const source = link.source as SimNode
      const target = link.target as SimNode
      if (!source.x || !source.y || !target.x || !target.y) continue

      const dimmed =
        matching !== null &&
        !matching.has(source.id) &&
        !matching.has(target.id)

      ctx.beginPath()
      ctx.moveTo(source.x, source.y)
      ctx.lineTo(target.x, target.y)
      ctx.strokeStyle = dimmed
        ? 'rgba(255,255,255,0.03)'
        : LINK_COLORS[link.type] || 'rgba(255,255,255,0.1)'
      ctx.lineWidth = link.type === 'tag' ? 0.5 : 1
      ctx.globalAlpha = dimmed ? 0.3 : link.type === 'tag' ? 0.3 : 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      const nx = node.x ?? 0
      const ny = node.y ?? 0
      const r = Math.max(3, Math.min(12, 3 + (node.linkCount || 0) * 1.5))
      const isMatch = matching === null || matching.has(node.id)
      const isHovered = hovered?.id === node.id

      ctx.beginPath()
      ctx.arc(nx, ny, r, 0, Math.PI * 2)
      ctx.fillStyle = isHovered
        ? NODE_COLOR_HIGHLIGHT
        : isMatch
          ? NODE_COLOR
          : NODE_COLOR_DIM
      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label
      const fontSize = Math.max(9, Math.min(13, 10 + (node.linkCount || 0) * 0.5))
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.fillStyle = isMatch ? LABEL_COLOR : LABEL_COLOR_DIM
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(node.name, nx, ny + r + 4)
    }

    ctx.restore()

    // Tooltip for hovered node
    if (hovered && hovered.x != null && hovered.y != null) {
      const sx = hovered.x * t.k + t.x
      const sy = hovered.y * t.k + t.y
      const label = hovered.name + (hovered.tags.length > 0 ? '  #' + hovered.tags.join(' #') : '')
      const connLabel = `${hovered.linkCount} connection${hovered.linkCount !== 1 ? 's' : ''}`

      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
      const textW = Math.max(ctx.measureText(label).width, ctx.measureText(connLabel).width) + 16

      const tipX = sx + 15
      const tipY = sy - 40

      ctx.fillStyle = 'rgba(22, 22, 24, 0.9)'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(tipX, tipY, textW, 40, 4)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#e5e5e7'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(label, tipX + 8, tipY + 6)
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#6a6a6e'
      ctx.fillText(connLabel, tipX + 8, tipY + 22)
    }
  }, [hoveredNode])

  // Resize canvas
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      draw()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    return () => observer.disconnect()
  }, [draw])

  // Initialize simulation when data changes
  useEffect(() => {
    if (!graphData || !canvasRef.current) return

    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    // Create simulation nodes/links (clone to avoid mutating original)
    const nodes: SimNode[] = graphData.nodes.map((n) => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * w * 0.5,
      y: h / 2 + (Math.random() - 0.5) * h * 0.5
    }))
    const links: SimLink[] = graphData.links.map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type
    }))

    nodesRef.current = nodes
    linksRef.current = links

    // Center transform
    transformRef.current = { x: 0, y: 0, k: 1 }

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.type === 'tag' ? 150 : 80))
          .strength((d) => (d.type === 'tag' ? 0.1 : 0.3))
      )
      .force('charge', forceManyBody().strength(-120).distanceMax(400))
      .force('center', forceCenter(w / 2, h / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => Math.max(3, 3 + (d.linkCount || 0) * 1.5) + 15)
      )
      .alphaDecay(0.02)
      .on('tick', draw)

    simRef.current = sim

    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [graphData, draw])

  // Redraw when filter changes
  useEffect(() => {
    draw()
  }, [filter, draw])

  // Mouse interactions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1

    const getCanvasPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getCanvasPos(e)
      const gpos = screenToGraph(pos.x, pos.y)

      if (dragRef.current.active && dragRef.current.node) {
        // Dragging a node
        const node = dragRef.current.node
        node.fx = gpos.x
        node.fy = gpos.y
        simRef.current?.alpha(0.3).restart()
        return
      }

      if (dragRef.current.active && !dragRef.current.node) {
        // Panning
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        transformRef.current.x += dx
        transformRef.current.y += dy
        dragRef.current.startX = e.clientX
        dragRef.current.startY = e.clientY
        draw()
        return
      }

      // Hover detection
      const node = nodeAtPosition(gpos.x, gpos.y)
      setHoveredNode(node)
      canvas.style.cursor = node ? 'pointer' : 'grab'
    }

    const handleMouseDown = (e: MouseEvent) => {
      const pos = getCanvasPos(e)
      const gpos = screenToGraph(pos.x, pos.y)
      const node = nodeAtPosition(gpos.x, gpos.y)

      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        node: node || null
      }

      if (node) {
        node.fx = node.x
        node.fy = node.y
        canvas.style.cursor = 'grabbing'
      } else {
        canvas.style.cursor = 'grabbing'
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (dragRef.current.node) {
        const node = dragRef.current.node
        // If barely moved, treat as click
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          onNodeClick(node.path)
        }
        node.fx = null
        node.fy = null
        simRef.current?.alpha(0.1).restart()
      }
      dragRef.current.active = false
      dragRef.current.node = null
      canvas.style.cursor = 'grab'
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const pos = getCanvasPos(e)
      const t = transformRef.current
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newK = Math.max(0.1, Math.min(5, t.k * factor))

      // Zoom toward cursor position
      t.x = pos.x - (pos.x - t.x) * (newK / t.k)
      t.y = pos.y - (pos.y - t.y) * (newK / t.k)
      t.k = newK
      draw()
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', () => {
      dragRef.current.active = false
      dragRef.current.node = null
      setHoveredNode(null)
    })
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [draw, onNodeClick, screenToGraph, nodeAtPosition])

  if (loading) {
    return (
      <div className="graph-loading">
        <p>Building graph...</p>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>No documents found in vault</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="graph-container">
      <canvas ref={canvasRef} className="graph-canvas" />
      <div className="graph-legend">
        <span className="graph-legend-item">
          <span className="graph-legend-line" style={{ background: '#5e9eff' }} />
          Wiki link
        </span>
        <span className="graph-legend-item">
          <span className="graph-legend-line" style={{ background: '#4ec9b0' }} />
          Markdown link
        </span>
        <span className="graph-legend-item">
          <span className="graph-legend-line" style={{ background: 'rgba(255,255,255,0.25)' }} />
          Shared tag
        </span>
      </div>
    </div>
  )
}
