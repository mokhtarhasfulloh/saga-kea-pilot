import { useState, useEffect } from 'react'
import { DnsRecordT, DnsRecordTypeT } from '../lib/schemas/dns'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface FilterCriteria {
  search: string
  type: DnsRecordTypeT | 'ALL'
  zone: string
  ttlMin: number | null
  ttlMax: number | null
  priority: number | null
  showOnlyErrors: boolean
  showOnlyRecent: boolean
  sortBy: 'name' | 'type' | 'ttl' | 'value'
  sortOrder: 'asc' | 'desc'
}

interface DnsRecordFilterProps {
  records: DnsRecordT[]
  onFilteredRecords: (filtered: DnsRecordT[]) => void
  zones?: string[]
  className?: string
}

const DNS_RECORD_TYPES: (DnsRecordTypeT | 'ALL')[] = [
  'ALL', 'A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT', 'CAA'
]

export default function DnsRecordFilter({ 
  records, 
  onFilteredRecords, 
  zones = [], 
  className = '' 
}: DnsRecordFilterProps) {
  const [filters, setFilters] = useState<FilterCriteria>({
    search: '',
    type: 'ALL',
    zone: '',
    ttlMin: null,
    ttlMax: null,
    priority: null,
    showOnlyErrors: false,
    showOnlyRecent: false,
    sortBy: 'name',
    sortOrder: 'asc'
  })
  
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [filteredCount, setFilteredCount] = useState(0)

  const applyFilters = (criteria: FilterCriteria) => {
    let filtered = [...records]

    // Text search (name, value, type)
    if (criteria.search.trim()) {
      const searchTerm = criteria.search.toLowerCase().trim()
      filtered = filtered.filter(record => 
        record.name.toLowerCase().includes(searchTerm) ||
        record.value.toLowerCase().includes(searchTerm) ||
        record.type.toLowerCase().includes(searchTerm) ||
        (record.zone && record.zone.toLowerCase().includes(searchTerm))
      )
    }

    // Record type filter
    if (criteria.type !== 'ALL') {
      filtered = filtered.filter(record => record.type === criteria.type)
    }

    // Zone filter
    if (criteria.zone) {
      filtered = filtered.filter(record => record.zone === criteria.zone)
    }

    // TTL range filter
    if (criteria.ttlMin !== null) {
      filtered = filtered.filter(record => (record.ttl || 0) >= criteria.ttlMin!)
    }
    if (criteria.ttlMax !== null) {
      filtered = filtered.filter(record => (record.ttl || 0) <= criteria.ttlMax!)
    }

    // Priority filter (for MX and SRV records)
    if (criteria.priority !== null) {
      filtered = filtered.filter(record => 
        (record.type === 'MX' || record.type === 'SRV') && 
        record.priority === criteria.priority
      )
    }

    // Error filter (basic validation)
    if (criteria.showOnlyErrors) {
      filtered = filtered.filter(record => {
        // Basic validation checks
        if (!record.name || !record.value || !record.type) return true
        if (record.type === 'A' && !/^(\d{1,3}\.){3}\d{1,3}$/.test(record.value)) return true
        if (record.type === 'AAAA' && !/^[0-9a-fA-F:]+$/.test(record.value)) return true
        if (record.type === 'MX' && !record.priority) return true
        if (record.type === 'SRV' && (!record.priority || !record.weight || !record.port)) return true
        return false
      })
    }

    // Recent filter (last 24 hours - would need actual timestamps)
    if (criteria.showOnlyRecent) {
      // This would require actual modification timestamps
      // For now, just show all records
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any
      
      switch (criteria.sortBy) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'type':
          aVal = a.type
          bVal = b.type
          break
        case 'ttl':
          aVal = a.ttl || 0
          bVal = b.ttl || 0
          break
        case 'value':
          aVal = a.value.toLowerCase()
          bVal = b.value.toLowerCase()
          break
        default:
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
      }

      if (aVal < bVal) return criteria.sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return criteria.sortOrder === 'asc' ? 1 : -1
      return 0
    })

    setFilteredCount(filtered.length)
    onFilteredRecords(filtered)
  }

  const updateFilter = (key: keyof FilterCriteria, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const clearFilters = () => {
    const defaultFilters: FilterCriteria = {
      search: '',
      type: 'ALL',
      zone: '',
      ttlMin: null,
      ttlMax: null,
      priority: null,
      showOnlyErrors: false,
      showOnlyRecent: false,
      sortBy: 'name',
      sortOrder: 'asc'
    }
    setFilters(defaultFilters)
    applyFilters(defaultFilters)
  }

  const hasActiveFilters = () => {
    return filters.search || 
           filters.type !== 'ALL' || 
           filters.zone || 
           filters.ttlMin !== null || 
           filters.ttlMax !== null || 
           filters.priority !== null || 
           filters.showOnlyErrors || 
           filters.showOnlyRecent
  }

  // Apply initial filters
  useEffect(() => {
    applyFilters(filters)
  }, [records])

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              placeholder="Name, value, or type..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Record Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Record Type</label>
            <select
              value={filters.type}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {DNS_RECORD_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Zone Filter */}
          {zones.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Zone</label>
              <select
                value={filters.zone}
                onChange={(e) => updateFilter('zone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Zones</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium mb-1">Sort By</label>
            <div className="flex gap-1">
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="name">Name</option>
                <option value="type">Type</option>
                <option value="ttl">TTL</option>
                <option value="value">Value</option>
              </select>
              <button
                onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {filters.sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
          </Button>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Showing {filteredCount} of {records.length} records
            </span>
            
            {hasActiveFilters() && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* TTL Range */}
              <div>
                <label className="block text-sm font-medium mb-1">TTL Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.ttlMin || ''}
                    onChange={(e) => updateFilter('ttlMin', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Min"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    value={filters.ttlMax || ''}
                    onChange={(e) => updateFilter('ttlMax', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Max"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium mb-1">Priority (MX/SRV)</label>
                <input
                  type="number"
                  value={filters.priority || ''}
                  onChange={(e) => updateFilter('priority', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Priority value"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Quick Filters */}
              <div>
                <label className="block text-sm font-medium mb-1">Quick Filters</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyErrors}
                      onChange={(e) => updateFilter('showOnlyErrors', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show only errors</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.showOnlyRecent}
                      onChange={(e) => updateFilter('showOnlyRecent', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show recent changes</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
