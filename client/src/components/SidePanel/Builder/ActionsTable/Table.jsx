import { useReactTable, flexRender, getCoreRowModel } from '@tanstack/react-table';
export default function DataTable({ columns, data }) {
    const table = useReactTable({
        columns,
        data,
        getCoreRowModel: getCoreRowModel(),
    });
    return (<table className="w-full text-sm">
      <thead>
        {table.getHeaderGroups().map((headerGroup, i) => (<tr key={i} className="border-token-border-light text-token-text-tertiary border-b text-left text-xs">
            {headerGroup.headers.map((header, j) => (<th key={j} className="py-1 font-normal">
                {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
              </th>))}
          </tr>))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row, i) => (<tr key={i} className="border-token-border-light border-b">
            {row.getVisibleCells().map((cell, j) => (<td key={j} className="py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>))}
          </tr>))}
      </tbody>
    </table>);
}
