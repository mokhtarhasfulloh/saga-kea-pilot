import { api } from './api'
import { caCall } from './keaClient'

// Kea API wrappers aligned with /api gateway; fallback to direct CA
export const Kea = {
  async configGet() {
    try { return await api('/kea/config', 'GET') } catch { return (await caCall('config-get')).arguments }
  },
  async leasePage(limit = 50, offset = 0) {
    try { return await api(`/kea/leases?limit=${limit}&offset=${offset}`, 'GET') } catch { return (await caCall('lease4-get-all', 'dhcp4', { limit, offset })).arguments }
  },
  async action(name: 'config-test'|'config-reload'|'config-write'|'config-set', args?: any) {
    try { return await api('/kea/action', 'POST', { action: name, args }) } catch { return await caCall(name, 'dhcp4', args) }
  },
  async actionDhcp4(name: string, args?: any) {
    try { return await api('/kea/action', 'POST', { action: name, args }) } catch { return await caCall(name, 'dhcp4', args) }
  },
  async actionDhcp6(name: string, args?: any) {
    try { return await api('/kea/action', 'POST', { action: name, args }) } catch { return await caCall(name, 'dhcp6', args) }
  },
  async configTestDhcp4(body: any) {
    return this.action('config-test', { Dhcp4: body })
  },
  async configSetWriteDhcp4(body: any) {
    await this.action('config-set', { Dhcp4: body })
    return this.action('config-write')
  },
  async subnetAdd(payload: any) {
    try { return await api('/kea/subnet', 'POST', payload) } catch { return await caCall('subnet4-add', 'dhcp4', payload) }
  },
  async subnetUpdate(payload: any) {
    try { return await api('/kea/subnet', 'PUT', payload) } catch { return await caCall('subnet4-update', 'dhcp4', payload) }
  },
  async reservationAdd(payload: any) {
    try { return await api('/kea/reservation', 'POST', payload) } catch { return await caCall('reservation-add', 'dhcp4', payload) }
  },
}

