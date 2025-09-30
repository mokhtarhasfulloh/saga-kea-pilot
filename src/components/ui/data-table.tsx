import * as React from 'react'

type Column<T> = { key: keyof T; header: string; render?: (row: T) => React.ReactNode }

export function DataTable<T extends Record<string, any>>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left border-b">
          <tr>
            {columns.map(c => <th key={String(c.key)} className="py-1 pr-4 font-medium">{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map(c => <td key={String(c.key)} className="py-1 pr-4">{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="py-2 text-gray-500">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

