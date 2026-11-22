import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ProfileSummaryStrip from './ProfileSummaryStrip'

let stats
vi.mock('../hooks/useProfileStats', () => ({ useProfileStats: () => ({ data: stats }) }))

describe('ProfileSummaryStrip', () => {
  afterEach(cleanup)

  it('shows stores and top category, and does not repeat the purchases count', () => {
    stats = { storesCount: 3, topCategory: 'Ropa' }
    const { container } = render(<ProfileSummaryStrip profileId="u" total={12} />)
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('tiendas')
    expect(container.textContent).toContain('Ropa')
    expect(container.textContent).not.toMatch(/compra/i)
    expect(container.textContent).not.toContain('12')
  })

  it('keeps its height with placeholders while the stats load', () => {
    stats = undefined
    const { container } = render(<ProfileSummaryStrip profileId="u" total={5} />)
    expect(container.firstChild.className).toContain('h-14')
    expect(container.textContent).toContain('–')
  })

  it('renders nothing for a profile without posts', () => {
    stats = undefined
    const { container } = render(<ProfileSummaryStrip profileId="u" total={0} />)
    expect(container.firstChild).toBeNull()
  })
})
