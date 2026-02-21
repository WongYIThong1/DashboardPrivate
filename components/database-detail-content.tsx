"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconArrowLeft,
  IconDownload,
  IconDatabase,
  IconTable,
  IconHash,
  IconLetterCase,
  IconCalendar,
  IconLoader2,
  IconCircleCheck,
  IconCopy,
  IconChevronRight,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface DatabaseDetailContentProps {
  taskId: string
  rowId: string
  basePath?: string
}

// Mock database info
const databaseInfo = {
  domain: "example.com",
  type: "MySQL",
  version: "8.0.32",
  status: "complete",
  totalRows: 15420,
  tables: 12,
  size: "24.5 MB",
}

// Mock schema data
const schemaData = [
  {
    name: "users",
    rows: 8542,
    columns: [
      { name: "id", type: "INT", key: "PRIMARY" },
      { name: "email", type: "VARCHAR(255)", key: "" },
      { name: "password", type: "VARCHAR(255)", key: "" },
      { name: "username", type: "VARCHAR(100)", key: "" },
      { name: "created_at", type: "DATETIME", key: "" },
      { name: "updated_at", type: "DATETIME", key: "" },
    ],
  },
  {
    name: "orders",
    rows: 4521,
    columns: [
      { name: "id", type: "INT", key: "PRIMARY" },
      { name: "user_id", type: "INT", key: "FOREIGN" },
      { name: "total", type: "DECIMAL(10,2)", key: "" },
      { name: "status", type: "VARCHAR(50)", key: "" },
      { name: "created_at", type: "DATETIME", key: "" },
    ],
  },
  {
    name: "products",
    rows: 1256,
    columns: [
      { name: "id", type: "INT", key: "PRIMARY" },
      { name: "name", type: "VARCHAR(255)", key: "" },
      { name: "price", type: "DECIMAL(10,2)", key: "" },
      { name: "stock", type: "INT", key: "" },
      { name: "category_id", type: "INT", key: "FOREIGN" },
    ],
  },
  {
    name: "sessions",
    rows: 892,
    columns: [
      { name: "id", type: "VARCHAR(255)", key: "PRIMARY" },
      { name: "user_id", type: "INT", key: "FOREIGN" },
      { name: "ip_address", type: "VARCHAR(45)", key: "" },
      { name: "user_agent", type: "TEXT", key: "" },
      { name: "last_activity", type: "INT", key: "" },
    ],
  },
  {
    name: "logs",
    rows: 209,
    columns: [
      { name: "id", type: "INT", key: "PRIMARY" },
      { name: "action", type: "VARCHAR(100)", key: "" },
      { name: "user_id", type: "INT", key: "FOREIGN" },
      { name: "created_at", type: "DATETIME", key: "" },
    ],
  },
]

// Mock preview data
const previewData = [
  { id: 1, email: "john@example.com", password: "5f4dcc3b5aa765d61d8327deb882cf99", username: "john_doe" },
  { id: 2, email: "jane@example.com", password: "e99a18c428cb38d5f260853678922e03", username: "jane_smith" },
  { id: 3, email: "bob@example.com", password: "d8578edf8458ce06fbc5bb76a58c5ca4", username: "bob_wilson" },
  { id: 4, email: "alice@example.com", password: "5d41402abc4b2a76b9719d911017c592", username: "alice_jones" },
  { id: 5, email: "mike@example.com", password: "098f6bcd4621d373cade4e832627b4f6", username: "mike_brown" },
]

const getTypeIcon = (type: string) => {
  if (type.includes("INT")) return IconHash
  if (type.includes("VARCHAR") || type.includes("TEXT")) return IconLetterCase
  if (type.includes("DATE") || type.includes("TIME")) return IconCalendar
  return IconDatabase
}

export function DatabaseDetailContent({
  taskId,
  rowId,
  basePath = "/dumper",
}: DatabaseDetailContentProps) {
  const [isDumping, setIsDumping] = React.useState(false)
  const [dumpComplete, setDumpComplete] = React.useState(false)
  const [selectedTable, setSelectedTable] = React.useState("users")
  const [selectedTables, setSelectedTables] = React.useState<string[]>([])
  const [selectedColumns, setSelectedColumns] = React.useState<Record<string, string[]>>({})

  const handleDump = (type: "selected" | "full") => {
    setIsDumping(true)
    setDumpComplete(false)
    setTimeout(() => {
      setIsDumping(false)
      setDumpComplete(true)
      setTimeout(() => setDumpComplete(false), 2000)
    }, 2000)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleTableSelection = (name: string) => {
    setSelectedTables(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    )
  }

  const toggleAllTables = () => {
    if (selectedTables.length === schemaData.length) {
      setSelectedTables([])
    } else {
      setSelectedTables(schemaData.map(t => t.name))
    }
  }

  const toggleColumnSelection = (tableName: string, columnName: string) => {
    setSelectedColumns(prev => {
      const tableColumns = prev[tableName] || []
      const newColumns = tableColumns.includes(columnName)
        ? tableColumns.filter(c => c !== columnName)
        : [...tableColumns, columnName]
      return { ...prev, [tableName]: newColumns }
    })
  }

  const toggleAllColumns = (tableName: string) => {
    const table = schemaData.find(t => t.name === tableName)
    if (!table) return
    
    const currentColumns = selectedColumns[tableName] || []
    if (currentColumns.length === table.columns.length) {
      setSelectedColumns(prev => ({ ...prev, [tableName]: [] }))
    } else {
      setSelectedColumns(prev => ({ ...prev, [tableName]: table.columns.map(c => c.name) }))
    }
  }

  const getTotalSelectedColumns = () => {
    return Object.values(selectedColumns).reduce((acc, cols) => acc + cols.length, 0)
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 font-[family-name:var(--font-inter)]">
      {/* Header */}
      <div className="flex flex-col border-b">
        <div className="h-16 px-6 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Link href={`${basePath}/${taskId}`}>
              <Button variant="ghost" size="icon" className="size-8">
                <IconArrowLeft className="size-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <IconDatabase className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-base font-medium">{databaseInfo.domain}</p>
                <p className="text-xs text-muted-foreground">{databaseInfo.type} {databaseInfo.version}</p>
              </div>
              <Badge variant="outline" className="bg-transparent border-border ml-2">
                <IconCircleCheck size={12} className="text-emerald-500" />
                <span className="text-foreground">Complete</span>
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleDump("selected")}
              disabled={isDumping}
            >
              {isDumping ? (
                <IconLoader2 className="size-4 mr-2 animate-spin" />
              ) : dumpComplete ? (
                <IconCircleCheck className="size-4 mr-2 text-emerald-500" />
              ) : (
                <IconDownload className="size-4 mr-2" />
              )}
              Dump Table
            </Button>
            <Button 
              size="sm" 
              onClick={() => handleDump("full")}
              disabled={isDumping}
            >
              {isDumping ? (
                <IconLoader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <IconDownload className="size-4 mr-2" />
              )}
              Full Dump
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Schema */}
          <Card className="rounded-xl lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <IconTable className="size-4" />
                  Schema
                </CardTitle>
                <Checkbox 
                  checked={selectedTables.length === schemaData.length}
                  onCheckedChange={toggleAllTables}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="single" collapsible defaultValue="users" className="px-4 pb-4">
                {schemaData.map((table) => (
                  <AccordionItem key={table.name} value={table.name}>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectedTables.includes(table.name)}
                        onCheckedChange={() => toggleTableSelection(table.name)}
                      />
                      <AccordionTrigger 
                        className="hover:no-underline py-3 flex-1"
                        onClick={() => setSelectedTable(table.name)}
                      >
                        <div className="flex items-center gap-2">
                          <IconTable className="size-4 text-muted-foreground" />
                          <span className="font-medium">{table.name}</span>
                          <Badge variant="secondary" className="text-xs font-[family-name:var(--font-jetbrains-mono)]">
                            {table.rows.toLocaleString()}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <div className="space-y-1 pl-8">
                        <div className="flex items-center justify-between py-1.5 text-sm border-b mb-2">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={(selectedColumns[table.name]?.length || 0) === table.columns.length}
                              onCheckedChange={() => toggleAllColumns(table.name)}
                            />
                            <span className="text-xs text-muted-foreground">Select all columns</span>
                          </div>
                        </div>
                        {table.columns.map((col) => {
                          const TypeIcon = getTypeIcon(col.type)
                          return (
                            <div key={col.name} className="flex items-center justify-between py-1.5 text-sm">
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  checked={selectedColumns[table.name]?.includes(col.name) || false}
                                  onCheckedChange={() => toggleColumnSelection(table.name, col.name)}
                                />
                                <TypeIcon className="size-3 text-muted-foreground" />
                                <span className={col.key ? "font-medium" : "text-muted-foreground"}>
                                  {col.name}
                                </span>
                                {col.key && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {col.key}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-[family-name:var(--font-jetbrains-mono)]">
                                {col.type}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {(selectedTables.length > 0 || getTotalSelectedColumns() > 0) && (
                <div className="px-4 py-3 border-t flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedTables.length > 0 && `${selectedTables.length} table(s)`}
                    {selectedTables.length > 0 && getTotalSelectedColumns() > 0 && ", "}
                    {getTotalSelectedColumns() > 0 && `${getTotalSelectedColumns()} column(s)`}
                  </span>
                  <Button size="sm" onClick={() => handleDump("selected")} disabled={isDumping}>
                    {isDumping ? (
                      <IconLoader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <IconDownload className="size-4 mr-2" />
                    )}
                    Dump
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Preview */}
          <Card className="rounded-xl lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <IconDatabase className="size-4" />
                  Data Preview
                  <Badge variant="secondary" className="ml-2">{selectedTable}</Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs">
                  View All
                  <IconChevronRight className="size-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-[family-name:var(--font-jetbrains-mono)]">
                          {row.id}
                        </TableCell>
                        <TableCell className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
                          {row.email}
                        </TableCell>
                        <TableCell className="font-[family-name:var(--font-jetbrains-mono)] text-sm text-muted-foreground">
                          {row.password.substring(0, 16)}...
                        </TableCell>
                        <TableCell>{row.username}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-7"
                            onClick={() => copyToClipboard(`${row.email}:${row.password}`)}
                          >
                            <IconCopy className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
