import * as React from 'react'

export const Table = (props: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className="min-w-full text-sm" {...props} />
)
export const Thead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="text-left border-b" {...props} />
)
export const Tbody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} />
)
export const Tr = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className="border-b last:border-0" {...props} />
)
export const Th = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={`py-1 pr-4 font-medium ${className || ''}`} {...props} />
)
export const Td = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`py-1 pr-4 ${className || ''}`} {...props} />
)

