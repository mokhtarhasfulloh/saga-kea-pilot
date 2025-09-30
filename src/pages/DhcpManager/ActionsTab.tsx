import { useEffect, useState } from 'react'
import { Kea } from '../../lib/keaApi'
import Button from '../../components/ui/button'
// import Input from '../../components/ui/input'
import { Alert } from '../../components/ui/alert'

export default function ActionsTab() {
  const [current, setCurrent] = useState<any>(null)
  const [candidate, setCandidate] = useState('')
  const [out, setOut] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadConfig() {
    setErr('')
    try {
      const cfg = await Kea.configGet()
      setCurrent(cfg?.Dhcp4 || cfg)
      setCandidate(JSON.stringify(cfg?.Dhcp4 || cfg, null, 2))
    } catch (e: any) { setErr(String(e)) }
  }

  useEffect(() => { loadConfig() }, [])

  function parseCandidate(): any | null {
    try { return JSON.parse(candidate) } catch { setErr('Candidate must be valid JSON'); return null }
  }

  async function doTest() {
    const body = parseCandidate(); if (!body) return
    setBusy(true); setErr(''); setOut(null)
    try { const r = await Kea.action('config-test', { Dhcp4: body }); setOut(r) }
    catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  async function doSetWrite() {
    const body = parseCandidate(); if (!body) return
    setBusy(true); setErr(''); setOut(null)
    try {
      await Kea.action('config-set', { Dhcp4: body })
      const r = await Kea.action('config-write')
      setOut(r)
    } catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  async function doReload() {
    setBusy(true); setErr(''); setOut(null)
    try { const r = await Kea.action('config-reload'); setOut(r) }
    catch (e: any) { setErr(String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      {err && <Alert variant="error">{err}</Alert>}
      <div className="flex gap-2 items-center">
        <Button onClick={loadConfig} disabled={busy}>Config Get</Button>
        <Button onClick={doTest} disabled={busy}>Config Test</Button>
        <Button onClick={doSetWrite} disabled={busy}>Config Write</Button>
        <Button variant="outline" onClick={doReload} disabled={busy}>Reload</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-sm font-semibold mb-1">Current Dhcp4</div>
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 overflow-auto max-h-72">{current ? JSON.stringify(current, null, 2) : 'No config loaded'}</pre>
        </div>
        <div>
          <div className="text-sm font-semibold mb-1">Candidate Dhcp4 (editable)</div>
          <textarea className="w-full text-xs bg-white dark:bg-black border rounded p-2 font-mono min-h-[18rem]"
            value={candidate} onChange={e => setCandidate(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-1">Diff (stub)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <pre className="text-xs bg-gray-50 dark:bg-gray-950 p-2 overflow-auto max-h-64">{current ? JSON.stringify(current, null, 2) : ''}</pre>
          <pre className="text-xs bg-gray-50 dark:bg-gray-950 p-2 overflow-auto max-h-64">{candidate}</pre>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-1">Output</div>
        <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 overflow-auto max-h-64">{out ? JSON.stringify(out, null, 2) : 'No output yet'}</pre>
      </div>
    </div>
  )
}
