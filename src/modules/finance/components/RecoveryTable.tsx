import { Fragment, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { StudentLabels } from "@/shared/hooks/useStudentLabel"
import { formatFcfa } from "@/shared/utils/formatting"
import { studentPlural, toFollowColumnLabel } from "@/shared/utils/student-label"
import type { RecoveryClass, RecoveryLevel, RecoveryMetrics } from "../finance.api"
import { RateBar, ratePercent } from "./RateBar"

type Props = {
  levels: RecoveryLevel[]
  classes: RecoveryClass[]
  total: RecoveryMetrics
  labels: StudentLabels
  onViewStudents: (schoolClass: RecoveryClass, opener: HTMLElement) => void
}

const num = "text-right tabular-nums"

function RateCell({ rate, label }: { rate: number; label: string }) {
  return <div className="flex items-center justify-end gap-2"><RateBar rate={rate} label={label} className="w-20" /><span className="w-12 text-right tabular-nums">{ratePercent(rate)} %</span></div>
}

export function RecoveryTable({ levels, classes, total, labels, onViewStudents }: Props) {
  // Par défaut, le premier niveau est ouvert ; l'état n'est pas mémorisé entre deux visites.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (levelId: string, index: number) => toggled[levelId] ?? index === 0
  const toggle = (levelId: string, index: number) => setToggled((current) => ({ ...current, [levelId]: !isOpen(levelId, index) }))
  const classesOf = (levelId: string) => classes.filter((item) => item.levelId === levelId)
  const viewLabel = `Voir les ${studentPlural(labels)}`

  return <>
    <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
      <Table className="min-w-[860px]">
        <TableHeader><TableRow>
          <TableHead>Niveau / classe</TableHead><TableHead className={num}>Effectif</TableHead><TableHead className={num}>Attendu</TableHead><TableHead className={num}>Encaissé</TableHead><TableHead className={num}>Reste</TableHead><TableHead className="text-right">Taux</TableHead><TableHead className={num}>{toFollowColumnLabel(labels)}</TableHead><TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {levels.map((level, index) => {
            const open = isOpen(level.levelId, index)
            const rows = classesOf(level.levelId)
            return <Fragment key={level.levelId}>
              <TableRow>
                <TableCell className="font-semibold"><button type="button" aria-expanded={open} onClick={() => toggle(level.levelId, index)} className="flex min-h-10 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{open ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}{level.levelName}<span className="text-xs font-normal text-muted-foreground">{rows.length} classe{rows.length > 1 ? "s" : ""}</span></button></TableCell>
                <TableCell className={num}>{level.studentCount}</TableCell><TableCell className={num}>{formatFcfa(level.expected)}</TableCell><TableCell className={num}>{formatFcfa(level.paid)}</TableCell><TableCell className={`${num} font-semibold`}>{formatFcfa(level.remaining)}</TableCell>
                <TableCell><RateCell rate={level.recoveryRate} label={`Taux de ${level.levelName}`} /></TableCell><TableCell className={num}>{level.studentsToFollow}</TableCell><TableCell />
              </TableRow>
              {open ? rows.map((item) => <TableRow key={item.classId} className="bg-muted/40">
                <TableCell className="pl-12">{item.className}</TableCell>
                <TableCell className={num}>{item.studentCount}</TableCell><TableCell className={num}>{formatFcfa(item.expected)}</TableCell><TableCell className={num}>{formatFcfa(item.paid)}</TableCell><TableCell className={`${num} font-semibold`}>{formatFcfa(item.remaining)}</TableCell>
                <TableCell><RateCell rate={item.recoveryRate} label={`Taux de ${item.className}`} /></TableCell><TableCell className={num}>{item.studentsToFollow}</TableCell>
                <TableCell className="text-right"><Button variant="link" className="min-h-10" onClick={(event) => onViewStudents(item, event.currentTarget)} aria-label={`${viewLabel} de ${item.className}`}>{viewLabel}</Button></TableCell>
              </TableRow>) : null}
            </Fragment>
          })}
          <TableRow className="border-t-2 font-semibold"><TableCell>Total</TableCell><TableCell className={num}>{total.studentCount}</TableCell><TableCell className={num}>{formatFcfa(total.expected)}</TableCell><TableCell className={num}>{formatFcfa(total.paid)}</TableCell><TableCell className={num}>{formatFcfa(total.remaining)}</TableCell><TableCell><RateCell rate={total.recoveryRate} label="Taux total" /></TableCell><TableCell className={num}>{total.studentsToFollow}</TableCell><TableCell /></TableRow>
        </TableBody>
      </Table>
    </div>

    <ul className="space-y-3 md:hidden" aria-label="Recouvrement par niveau et par classe">
      {levels.map((level, index) => {
        const open = isOpen(level.levelId, index)
        const rows = classesOf(level.levelId)
        return <li key={level.levelId} className="rounded-lg border bg-card">
          <button type="button" aria-expanded={open} onClick={() => toggle(level.levelId, index)} className="flex min-h-12 w-full items-center justify-between gap-2 p-4 text-left font-semibold">
            <span className="flex items-center gap-2">{open ? <ChevronDown aria-hidden="true" className="h-4 w-4" /> : <ChevronRight aria-hidden="true" className="h-4 w-4" />}{level.levelName}</span><span className="text-sm tabular-nums">{ratePercent(level.recoveryRate)} %</span>
          </button>
          {open ? <ul className="divide-y border-t">{rows.map((item) => <li key={item.classId} className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between font-medium"><span>{item.className}</span><span className="tabular-nums">{ratePercent(item.recoveryRate)} %</span></div>
            <RateBar rate={item.recoveryRate} label={`Taux de ${item.className}`} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground"><dt>Effectif</dt><dd className={`${num} text-foreground`}>{item.studentCount}</dd><dt>Attendu</dt><dd className={`${num} text-foreground`}>{formatFcfa(item.expected)}</dd><dt>Encaissé</dt><dd className={`${num} text-foreground`}>{formatFcfa(item.paid)}</dd><dt>Reste</dt><dd className={`${num} font-semibold text-foreground`}>{formatFcfa(item.remaining)}</dd><dt>{toFollowColumnLabel(labels)}</dt><dd className={`${num} text-foreground`}>{item.studentsToFollow}</dd></dl>
            <Button variant="outline" className="min-h-10 w-full" onClick={(event) => onViewStudents(item, event.currentTarget)} aria-label={`${viewLabel} de ${item.className}`}>{viewLabel}</Button>
          </li>)}</ul> : null}
        </li>
      })}
      <li className="rounded-lg border bg-card p-4 text-sm font-semibold"><div className="flex justify-between"><span>Total</span><span className="tabular-nums">{ratePercent(total.recoveryRate)} %</span></div><p className="mt-1 font-normal text-muted-foreground">{formatFcfa(total.paid)} / {formatFcfa(total.expected)} · reste {formatFcfa(total.remaining)}</p></li>
    </ul>
  </>
}
