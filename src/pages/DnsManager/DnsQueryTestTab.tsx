import { useState } from 'react'
import { DnsRecordTypeT } from '../../lib/schemas/dns'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { useToast, ToastContainer } from '../../components/Toast'

interface QueryResult {
  query: string
  type: string
  server: string
  timestamp: string
  success: boolean
  responseTime: number
  answers: any[]
  authority: any[]
  additional: any[]
  error?: string
  rawResponse?: string
}

interface QueryHistory {
  id: string
  query: string
  type: string
  server: string
  timestamp: string
  success: boolean
  responseTime: number
}

const DNS_QUERY_TYPES: DnsRecordTypeT[] = [
  'A', 'AAAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT', 'CAA'
]

const COMMON_DNS_SERVERS = [
  { name: 'Local BIND9', address: '127.0.0.1' },
  { name: 'Google DNS', address: '8.8.8.8' },
  { name: 'Cloudflare DNS', address: '1.1.1.1' },
  { name: 'Quad9 DNS', address: '9.9.9.9' },
  { name: 'OpenDNS', address: '208.67.222.222' }
]

export default function DnsQueryTestTab() {
  const [queryName, setQueryName] = useState('')
  const [queryType, setQueryType] = useState<DnsRecordTypeT>('A')
  const [dnsServer, setDnsServer] = useState('127.0.0.1')
  const [customServer, setCustomServer] = useState('')
  const [useCustomServer, setUseCustomServer] = useState(false)
  const [querying, setQuerying] = useState(false)
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null)
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [showRawResponse, setShowRawResponse] = useState(false)
  const toast = useToast()

  const performDnsQuery = async () => {
    if (!queryName.trim()) {
      toast.error('Validation Error', 'Please enter a domain name to query')
      return
    }

    const serverToUse = useCustomServer ? customServer : dnsServer
    if (!serverToUse.trim()) {
      toast.error('Validation Error', 'Please specify a DNS server')
      return
    }

    setQuerying(true)
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    try {
      // Simulate DNS query using dig command via API
      const response = await fetch('/api/dns/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: queryName.trim(),
          type: queryType,
          server: serverToUse.trim()
        })
      })

      const responseTime = Date.now() - startTime
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'DNS query failed')
      }

      const queryResult: QueryResult = {
        query: queryName.trim(),
        type: queryType,
        server: serverToUse.trim(),
        timestamp,
        success: true,
        responseTime,
        answers: result.answers || [],
        authority: result.authority || [],
        additional: result.additional || [],
        rawResponse: result.rawResponse
      }

      setCurrentResult(queryResult)
      
      // Add to history
      const historyEntry: QueryHistory = {
        id: `${Date.now()}-${Math.random()}`,
        query: queryName.trim(),
        type: queryType,
        server: serverToUse.trim(),
        timestamp,
        success: true,
        responseTime
      }
      
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 49)]) // Keep last 50 queries
      
      toast.success('Query Successful', `DNS query completed in ${responseTime}ms`)

    } catch (error: any) {
      const responseTime = Date.now() - startTime
      
      const queryResult: QueryResult = {
        query: queryName.trim(),
        type: queryType,
        server: serverToUse.trim(),
        timestamp,
        success: false,
        responseTime,
        answers: [],
        authority: [],
        additional: [],
        error: error.message
      }

      setCurrentResult(queryResult)
      
      // Add failed query to history
      const historyEntry: QueryHistory = {
        id: `${Date.now()}-${Math.random()}`,
        query: queryName.trim(),
        type: queryType,
        server: serverToUse.trim(),
        timestamp,
        success: false,
        responseTime
      }
      
      setQueryHistory(prev => [historyEntry, ...prev.slice(0, 49)])
      
      toast.error('Query Failed', error.message)
    } finally {
      setQuerying(false)
    }
  }

  const clearHistory = () => {
    setQueryHistory([])
    toast.success('History Cleared', 'Query history has been cleared')
  }

  const repeatQuery = (historyItem: QueryHistory) => {
    setQueryName(historyItem.query)
    setQueryType(historyItem.type as DnsRecordTypeT)
    setDnsServer(historyItem.server)
    setUseCustomServer(!COMMON_DNS_SERVERS.some(s => s.address === historyItem.server))
    if (!COMMON_DNS_SERVERS.some(s => s.address === historyItem.server)) {
      setCustomServer(historyItem.server)
    }
  }

  const formatAnswer = (answer: any) => {
    if (typeof answer === 'string') return answer
    if (answer.data) return answer.data
    return JSON.stringify(answer)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">DNS Query Testing Tools</h3>
      </div>

      {/* Query Form */}
      <Card className="p-6">
        <h4 className="text-md font-medium mb-4">DNS Query</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Domain Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Domain Name *</label>
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && performDnsQuery()}
            />
          </div>

          {/* Query Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Record Type</label>
            <select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value as DnsRecordTypeT)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DNS_QUERY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* DNS Server */}
          <div>
            <label className="block text-sm font-medium mb-1">DNS Server</label>
            {!useCustomServer ? (
              <select
                value={dnsServer}
                onChange={(e) => setDnsServer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_DNS_SERVERS.map(server => (
                  <option key={server.address} value={server.address}>
                    {server.name} ({server.address})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customServer}
                onChange={(e) => setCustomServer(e.target.value)}
                placeholder="8.8.8.8"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <label className="flex items-center mt-1">
              <input
                type="checkbox"
                checked={useCustomServer}
                onChange={(e) => setUseCustomServer(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Custom server</span>
            </label>
          </div>

          {/* Query Button */}
          <div className="flex items-end">
            <Button
              onClick={performDnsQuery}
              disabled={querying || !queryName.trim()}
              className="w-full"
            >
              {querying ? 'Querying...' : 'Query DNS'}
            </Button>
          </div>
        </div>

        {/* Quick Query Buttons */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 mr-2">Quick queries:</span>
          {['google.com', 'cloudflare.com', 'github.com', 'stackoverflow.com'].map(domain => (
            <Button
              key={domain}
              variant="outline"
              size="sm"
              onClick={() => setQueryName(domain)}
            >
              {domain}
            </Button>
          ))}
        </div>
      </Card>

      {/* Query Results */}
      {currentResult && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium">Query Results</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawResponse(!showRawResponse)}
              >
                {showRawResponse ? 'Hide' : 'Show'} Raw Response
              </Button>
            </div>
          </div>

          {/* Query Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded">
            <div>
              <div className="text-sm text-gray-600">Query</div>
              <div className="font-mono">{currentResult.query}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Type</div>
              <div className="font-mono">{currentResult.type}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Server</div>
              <div className="font-mono">{currentResult.server}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Response Time</div>
              <div className={`font-mono ${currentResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {currentResult.responseTime}ms
              </div>
            </div>
          </div>

          {/* Results */}
          {currentResult.success ? (
            <div className="space-y-4">
              {/* Answers */}
              {currentResult.answers.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Answer Section ({currentResult.answers.length})</h5>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    {currentResult.answers.map((answer, index) => (
                      <div key={index} className="font-mono text-sm text-green-800">
                        {formatAnswer(answer)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authority */}
              {currentResult.authority.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Authority Section ({currentResult.authority.length})</h5>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    {currentResult.authority.map((auth, index) => (
                      <div key={index} className="font-mono text-sm text-blue-800">
                        {formatAnswer(auth)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional */}
              {currentResult.additional.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Additional Section ({currentResult.additional.length})</h5>
                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    {currentResult.additional.map((add, index) => (
                      <div key={index} className="font-mono text-sm text-purple-800">
                        {formatAnswer(add)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {currentResult.answers.length === 0 && currentResult.authority.length === 0 && currentResult.additional.length === 0 && (
                <div className="text-center text-gray-600 py-4">
                  No DNS records found
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <div className="text-red-800 font-medium">Query Failed</div>
              <div className="text-red-600 text-sm mt-1">{currentResult.error}</div>
            </div>
          )}

          {/* Raw Response */}
          {showRawResponse && currentResult.rawResponse && (
            <div className="mt-4">
              <h5 className="font-medium mb-2">Raw Response</h5>
              <pre className="bg-gray-100 border rounded p-3 text-sm overflow-x-auto">
                {currentResult.rawResponse}
              </pre>
            </div>
          )}
        </Card>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium">Query History ({queryHistory.length})</h4>
            <Button variant="outline" size="sm" onClick={clearHistory}>
              Clear History
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Time</th>
                  <th className="text-left p-2 font-medium">Query</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-left p-2 font-medium">Server</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Response Time</th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queryHistory.slice(0, 20).map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-sm">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-2 font-mono text-sm">{item.query}</td>
                    <td className="p-2 font-mono text-sm">{item.type}</td>
                    <td className="p-2 font-mono text-sm">{item.server}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-sm">{item.responseTime}ms</td>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => repeatQuery(item)}
                      >
                        Repeat
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  )
}
