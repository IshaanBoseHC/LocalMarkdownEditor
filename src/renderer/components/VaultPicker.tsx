import React from 'react'

interface VaultPickerProps {
  onVaultSelected: (path: string) => void
}

export function VaultPicker({ onVaultSelected }: VaultPickerProps) {
  const handleOpen = async () => {
    const path = await window.api.openVault()
    if (path) {
      onVaultSelected(path)
    }
  }

  return (
    <div className="vault-picker" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="vault-picker-content">
        <h1 className="vault-picker-title">ObsidianDupe</h1>
        <p className="vault-picker-subtitle">A local markdown editor</p>
        <button
          className="vault-picker-button"
          onClick={handleOpen}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          Open Vault
        </button>
      </div>
    </div>
  )
}
