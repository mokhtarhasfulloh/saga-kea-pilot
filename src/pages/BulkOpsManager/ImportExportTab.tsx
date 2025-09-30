import { useState } from 'react'
import Button from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Card, CardHeader, CardContent } from '../../components/ui/card'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table'

interface ImportExportJob {
  id: string
  type: 'import' | 'export'
  category: 'reservations' | 'subnets' | 'options' | 'full-config'
  status: 'pending' | 'running' | 'completed' | 'failed'
  filename: string
  records: number
  progress: number
  started: string
  completed?: string
  error?: string
}

export default function ImportExportTab() {
  const [jobs, setJobs] = useState<ImportExportJob[]>([
    {
      id: 'job-1',
      type: 'export',
      category: 'reservations',
      status: 'completed',
      filename: 'reservations-export-2024-01-20.csv',
      records: 1250,
      progress: 100,
      started: '2024-01-20T10:00:00Z',
      completed: '2024-01-20T10:02:15Z'
    },
    {
      id: 'job-2',
      type: 'import',
      category: 'subnets',
      status: 'failed',
      filename: 'new-subnets.json',
      records: 0,
      progress: 25,
      started: '2024-01-21T14:30:00Z',
      error: 'Invalid subnet format in line 15'
    }
  ])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importCategory, setImportCategory] = useState<ImportExportJob['category']>('reservations')
  const [exportCategory, setExportCategory] = useState<ImportExportJob['category']>('reservations')
  const [processing, setProcessing] = useState(false)

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
    setError('')
  }

  async function startImport() {
    if (!selectedFile) {
      setError('Please select a file to import')
      return
    }

    setProcessing(true)
    setError('')
    setSuccess('')

    try {
      // Simulate import process
      const newJob: ImportExportJob = {
        id: `job-${Date.now()}`,
        type: 'import',
        category: importCategory,
        status: 'running',
        filename: selectedFile.name,
        records: 0,
        progress: 0,
        started: new Date().toISOString()
      }

      setJobs(prev => [newJob, ...prev])
      setSuccess('Import job started successfully')
      setSelectedFile(null)

      // Simulate progress updates
      setTimeout(() => {
        setJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { ...job, progress: 50 }
            : job
        ))
      }, 1000)

      setTimeout(() => {
        setJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { 
                ...job, 
                status: 'completed', 
                progress: 100, 
                records: Math.floor(Math.random() * 1000) + 100,
                completed: new Date().toISOString()
              }
            : job
        ))
      }, 3000)

    } catch (e: any) {
      setError(`Import failed: ${String(e)}`)
    } finally {
      setProcessing(false)
    }
  }

  async function startExport() {
    setProcessing(true)
    setError('')
    setSuccess('')

    try {
      const newJob: ImportExportJob = {
        id: `job-${Date.now()}`,
        type: 'export',
        category: exportCategory,
        status: 'running',
        filename: `${exportCategory}-export-${new Date().toISOString().split('T')[0]}.csv`,
        records: 0,
        progress: 0,
        started: new Date().toISOString()
      }

      setJobs(prev => [newJob, ...prev])
      setSuccess('Export job started successfully')

      // Simulate export process
      setTimeout(() => {
        setJobs(prev => prev.map(job => 
          job.id === newJob.id 
            ? { 
                ...job, 
                status: 'completed', 
                progress: 100, 
                records: Math.floor(Math.random() * 2000) + 500,
                completed: new Date().toISOString()
              }
            : job
        ))
      }, 2000)

    } catch (e: any) {
      setError(`Export failed: ${String(e)}`)
    } finally {
      setProcessing(false)
    }
  }

  function downloadExport(job: ImportExportJob) {
    if (job.type !== 'export' || job.status !== 'completed') return

    // Simulate file download
    const data = generateSampleData(job.category, job.records)
    const blob = new Blob([data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = job.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function generateSampleData(category: string, records: number): string {
    switch (category) {
      case 'reservations':
        return `MAC Address,IP Address,Hostname\n` +
               Array.from({length: Math.min(records, 10)}, (_, i) => 
                 `00:11:22:33:44:${(i+10).toString(16).padStart(2, '0')},192.168.1.${100+i},host-${i+1}`
               ).join('\n')
      case 'subnets':
        return `Subnet,Pool Start,Pool End,Gateway\n` +
               Array.from({length: Math.min(records, 5)}, (_, i) => 
                 `192.168.${i+1}.0/24,192.168.${i+1}.100,192.168.${i+1}.200,192.168.${i+1}.1`
               ).join('\n')
      case 'options':
        return `Option Name,Code,Data,Scope\n` +
               `routers,,192.168.1.1,global\n` +
               `domain-name-servers,,8.8.8.8,global\n` +
               `domain-name,,example.com,global`
      default:
        return 'Sample export data'
    }
  }

  function deleteJob(id: string) {
    if (!confirm('Delete this job?')) return
    setJobs(prev => prev.filter(j => j.id !== id))
    setSuccess('Job deleted successfully')
  }

  // function getStatusColor(status: string): string {
  //   switch (status) {
  //     case 'completed': return 'text-green-600'
  //     case 'running': return 'text-blue-600'
  //     case 'failed': return 'text-red-600'
  //     case 'pending': return 'text-yellow-600'
  //     default: return 'text-gray-600'
  //   }
  // }

  function getStatusBadge(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Import/Export Operations</h2>
        <p className="text-sm text-gray-600">
          Bulk import and export of DHCP configuration data
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Import/Export Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <h3 className="font-medium">Import Data</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Data Type
              </label>
              <select
                value={importCategory}
                onChange={e => setImportCategory(e.target.value as ImportExportJob['category'])}
                className="w-full px-3 py-2 border rounded"
                disabled={processing}
              >
                <option value="reservations">Host Reservations</option>
                <option value="subnets">Subnets & Pools</option>
                <option value="options">DHCP Options</option>
                <option value="full-config">Full Configuration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Select File
              </label>
              <input
                type="file"
                accept=".csv,.json,.xml"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border rounded"
                disabled={processing}
              />
              {selectedFile && (
                <div className="text-sm text-gray-600 mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <Button 
              onClick={startImport} 
              disabled={processing || !selectedFile}
              className="w-full"
            >
              {processing ? 'Importing...' : 'Start Import'}
            </Button>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <h3 className="font-medium">Export Data</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Data Type
              </label>
              <select
                value={exportCategory}
                onChange={e => setExportCategory(e.target.value as ImportExportJob['category'])}
                className="w-full px-3 py-2 border rounded"
                disabled={processing}
              >
                <option value="reservations">Host Reservations</option>
                <option value="subnets">Subnets & Pools</option>
                <option value="options">DHCP Options</option>
                <option value="full-config">Full Configuration</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Export Format
              </label>
              <select
                className="w-full px-3 py-2 border rounded"
                disabled={processing}
              >
                <option value="csv">CSV (Comma Separated)</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
              </select>
            </div>

            <Button 
              onClick={startExport} 
              disabled={processing}
              className="w-full"
            >
              {processing ? 'Exporting...' : 'Start Export'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Job History */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Import/Export History</h3>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Type</Th>
                  <Th>Category</Th>
                  <Th>Filename</Th>
                  <Th>Status</Th>
                  <Th>Records</Th>
                  <Th>Progress</Th>
                  <Th>Started</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {jobs.map((job) => (
                  <Tr key={job.id}>
                    <Td>
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.type === 'import' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {job.type.toUpperCase()}
                      </span>
                    </Td>
                    <Td className="text-sm">{job.category}</Td>
                    <Td className="font-mono text-sm">{job.filename}</Td>
                    <Td>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(job.status)}`}>
                        {job.status}
                      </span>
                      {job.error && (
                        <div className="text-xs text-red-600 mt-1">{job.error}</div>
                      )}
                    </Td>
                    <Td className="text-center">{job.records.toLocaleString()}</Td>
                    <Td>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            job.status === 'completed' ? 'bg-green-500' :
                            job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1">{job.progress}%</div>
                    </Td>
                    <Td className="text-sm text-gray-600">{formatTimestamp(job.started)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        {job.type === 'export' && job.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadExport(job)}
                          >
                            Download
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteJob(job.id)}
                          disabled={job.status === 'running'}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">No Import/Export Jobs</div>
              <div className="text-sm">Start an import or export operation to see history</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import/Export Information */}
      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-medium text-blue-800 mb-2">Import/Export Guide</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• <strong>Supported Formats:</strong> CSV, JSON, XML for different data types</div>
          <div>• <strong>Reservations:</strong> MAC address, IP address, hostname, options</div>
          <div>• <strong>Subnets:</strong> Network, pools, options, and configuration</div>
          <div>• <strong>Validation:</strong> Data is validated before import to prevent errors</div>
          <div>• <strong>Backup:</strong> Always create a snapshot before large imports</div>
          <div>• <strong>Progress:</strong> Monitor import/export progress in real-time</div>
        </div>
      </div>
    </div>
  )
}
