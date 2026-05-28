import React, { useCallback, useRef, useEffect } from 'react'
import { TabInfo } from '../../context/VaultContext'

interface TabBarProps {
  tabs: TabInfo[]
  activeTabIndex: number
  onTabClick: (index: number) => void
  onTabClose: (index: number) => void
  onTabMiddleClick: (index: number) => void
}

export function TabBar({ tabs, activeTabIndex, onTabClick, onTabClose, onTabMiddleClick }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeTabIndex])

  const handleClose = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    onTabClose(index)
  }, [onTabClose])

  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    // Middle-click to close
    if (e.button === 1) {
      e.preventDefault()
      onTabMiddleClick(index)
    }
  }, [onTabMiddleClick])

  if (tabs.length === 0) return null

  return (
    <div className="tab-bar" ref={containerRef}>
      <div className="tab-bar-scroll">
        {tabs.map((tab, index) => {
          const fileName = tab.filePath.split('/').pop() || ''
          const isActive = index === activeTabIndex

          return (
            <div
              key={tab.filePath}
              ref={isActive ? activeTabRef : undefined}
              className={`tab-item ${isActive ? 'tab-active' : ''} ${tab.isDirty ? 'tab-dirty' : ''}`}
              onClick={() => onTabClick(index)}
              onMouseDown={(e) => handleMouseDown(e, index)}
              title={tab.filePath}
            >
              <span className="tab-label">
                {tab.isDirty && <span className="tab-dirty-dot" />}
                {fileName}
              </span>
              <button
                className="tab-close-btn"
                onClick={(e) => handleClose(e, index)}
                title="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
