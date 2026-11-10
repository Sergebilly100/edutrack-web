import type { GradingPeriod, SchoolYear } from "@/modules/academic/academic.api"
import { businessToday, formatAcademicDate, timelineMonthTicks, timelinePosition } from "@/shared/lib/academic-calendar"

type Props = { year: SchoolYear; periods: GradingPeriod[]; currentPeriodId: string; today?: string }
function visibleStatus(period: GradingPeriod, year: SchoolYear, currentPeriodId: string, today: string) {
  if (period.isClosed) return "Clôturée"
  if (year.status === "closed") return "Année clôturée"
  if (period.id === currentPeriodId) return "En cours"
  return period.startDate > today ? "À venir" : "Autre période"
}

export function AcademicTimeline({ year, periods, currentPeriodId, today = businessToday() }: Props) {
  const left = 146
  const right = 1152
  const x = (date: string) => left + timelinePosition(date, year.startDate, year.endDate) * (right - left) / 100
  const rows = Math.max(periods.length, 1)
  const milestonesY = 54 + rows * 40
  const axisY = milestonesY + 24
  const months = timelineMonthTicks(year.startDate, year.endDate)
  const todayInYear = today >= year.startDate && today <= year.endDate
  const decisionInYear = year.endOfYearReviewStartDate >= year.startDate && year.endOfYearReviewStartDate <= year.endDate
  const hasOpenPeriods = periods.some((period) => !period.isClosed && year.status !== "closed")
  const hasClosedPeriods = periods.some((period) => period.isClosed || year.status === "closed")
  const description = `${year.label}. ${periods.map((period) => `${period.label} du ${formatAcademicDate(period.startDate)} au ${formatAcademicDate(period.endDate)}, revue dès le ${formatAcademicDate(period.reviewStartDate)}`).join(". ")}. Aujourd’hui ${formatAcademicDate(today)}${todayInYear ? "" : ", hors de cette année"}. Décisions dès le ${formatAcademicDate(year.endOfYearReviewStartDate)}. Fin le ${formatAcademicDate(year.endDate)}.`

  return <section className="rounded-lg border bg-card p-4 md:p-6" aria-labelledby="timeline-heading" data-tour="years-timeline">
    <h2 id="timeline-heading" className="text-lg font-semibold">Calendrier de l’année · {year.label}</h2>
    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">Les périodes successives se chevauchent volontairement.</p>
    <div className="mt-4 max-w-full overflow-x-auto" tabIndex={0} aria-label="Frise chronologique, défilement horizontal possible">
      <svg className="block w-full min-w-[1000px]" viewBox={`0 0 1200 ${axisY + 32}`} role="img" aria-label={description}>
        <g>
          <line x1={x(today)} x2={x(today)} y1="28" y2={milestonesY - 24} className="stroke-slate-900 dark:stroke-slate-100" strokeWidth="1.5" />
          <text x={x(today)} y="19" textAnchor={x(today) > 930 ? "end" : "start"} className="fill-slate-900 text-[10px] font-medium dark:fill-slate-100">
            Aujourd’hui · {formatAcademicDate(today)}{todayInYear ? "" : " (hors année)"}
          </text>
        </g>
        {periods.length === 0 ? <text x="0" y="65" className="fill-slate-700 text-[10px] dark:fill-slate-200">Aucune période configurée</text> : null}
        {periods.map((period, index) => {
          const y = 44 + index * 40
          const closed = period.isClosed || year.status === "closed"
          const startX = x(period.startDate)
          const reviewX = x(period.reviewStartDate)
          const endX = x(period.endDate)
          const status = visibleStatus(period, year, currentPeriodId, today)
          return <g key={period.id}>
            <title>{period.label} : {formatAcademicDate(period.startDate)} au {formatAcademicDate(period.endDate)} ; revue dès le {formatAcademicDate(period.reviewStartDate)} ; {status}.</title>
            <text x="0" y={y + 9} className="fill-slate-900 text-[11px] font-medium dark:fill-slate-100">{period.label.length > 17 ? `${period.label.slice(0, 16)}…` : period.label}</text>
            <text x="0" y={y + 25} className="fill-slate-700 text-[10px] dark:fill-slate-200">{status}</text>
            <rect x={startX} y={y + 5} width={Math.max(1, reviewX - startX)} height="14" className={closed ? "fill-slate-300 dark:fill-slate-600" : "fill-blue-300 dark:fill-blue-600"} />
            <rect x={reviewX} y={y + 5} width={Math.max(1, endX - reviewX)} height="14" className={closed ? "fill-slate-600 dark:fill-slate-400" : "fill-blue-700 dark:fill-blue-400"} />
          </g>
        })}
        <text x="0" y={milestonesY + 4} className="fill-slate-900 text-[11px] font-medium dark:fill-slate-100">Fin d’année</text>
        <line x1={left} x2={right} y1={milestonesY} y2={milestonesY} className="stroke-slate-300 dark:stroke-slate-500" />
        {decisionInYear ? <g>
          <path d={`M ${x(year.endOfYearReviewStartDate)} ${milestonesY - 8} l 8 8 -8 8 -8 -8 Z`} className="fill-amber-700" />
          <text x={x(year.endOfYearReviewStartDate)} y={milestonesY - 12} textAnchor={x(year.endOfYearReviewStartDate) > 930 ? "end" : "start"} className="fill-amber-800 text-[10px] font-medium dark:fill-amber-300">Décisions · {formatAcademicDate(year.endOfYearReviewStartDate)}</text>
        </g> : null}
        <line x1={right} x2={right} y1={milestonesY - 9} y2={milestonesY + 9} className="stroke-slate-900 dark:stroke-slate-100" strokeWidth="2" />
        <text x={right} y={milestonesY + 18} textAnchor="end" className="fill-slate-900 text-[10px] dark:fill-slate-100">Fin · {formatAcademicDate(year.endDate)}</text>
        <line x1={left} x2={right} y1={axisY} y2={axisY} className="stroke-slate-300 dark:stroke-slate-500" />
        {months.map((month, index) => <g key={month.date}>
          <line x1={x(month.date)} x2={x(month.date)} y1={axisY} y2={axisY + 4} className="stroke-slate-400 dark:stroke-slate-500" />
          <text x={x(month.date)} y={axisY + 18} textAnchor={index === 0 ? "start" : index === months.length - 1 ? "end" : "middle"} className="fill-slate-700 text-[10px] dark:fill-slate-200">{month.label}</text>
        </g>)}
      </svg>
    </div>
    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200 lg:hidden">Faites défiler la frise horizontalement pour voir toute l’année →</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700 dark:text-slate-200">
      {hasOpenPeriods ? <>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-blue-300 dark:bg-blue-600" aria-hidden="true" />Période</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-blue-700 dark:bg-blue-400" aria-hidden="true" />Revue et préparation des bulletins</span>
      </> : null}
      {hasClosedPeriods ? <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-2.5 w-6 overflow-hidden rounded-sm" aria-hidden="true"><span className="w-1/2 bg-slate-300 dark:bg-slate-600" /><span className="w-1/2 bg-slate-600 dark:bg-slate-400" /></span>Période clôturée</span> : null}
      <span className="inline-flex items-center gap-1.5"><span className="h-4 w-0.5 bg-slate-900 dark:bg-slate-100" aria-hidden="true" />Aujourd’hui</span>
      {decisionInYear ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-amber-700" aria-hidden="true" />Décisions</span> : null}
    </div>
    <ul className="sr-only">{periods.map((period) => <li key={period.id}>{period.label} : début {formatAcademicDate(period.startDate)}, revue {formatAcademicDate(period.reviewStartDate)}, fin {formatAcademicDate(period.endDate)}.</li>)}<li>Décisions {formatAcademicDate(year.endOfYearReviewStartDate)}. Fin d’année {formatAcademicDate(year.endDate)}.</li></ul>
  </section>
}
