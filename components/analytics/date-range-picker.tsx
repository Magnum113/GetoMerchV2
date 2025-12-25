"use client"
import { CalendarIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    if (!date) return

    if (!dateRange?.from || (dateRange.from && dateRange.to)) {
      // Первый клик или сброс - устанавливаем начальную дату
      onDateRangeChange({ from: date, to: undefined })
      // НЕ закрываем попап - даем выбрать второй день
    } else {
      // Второй клик - устанавливаем конечную дату
      if (date < dateRange.from) {
        // Если выбрана дата раньше начальной, делаем её началом
        onDateRangeChange({ from: date, to: dateRange.from })
      } else {
        onDateRangeChange({ from: dateRange.from, to: date })
      }
      // Теперь закрываем попап после выбора второго дня
      setIsOpen(false)
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
                </>
              ) : (
                <>
                  {formatDate(dateRange.from)} <span className="text-muted-foreground">(выберите конец периода)</span>
                </>
              )
            ) : (
              <span>Выберите период</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="single"
            selected={dateRange?.to || dateRange?.from}
            onSelect={handleSelect}
            numberOfMonths={2}
            modifiers={{
              rangeStart: dateRange?.from,
              rangeEnd: dateRange?.to,
              rangeMiddle:
                dateRange?.from && dateRange?.to
                  ? (date: Date) => date > dateRange.from! && date < dateRange.to!
                  : undefined,
            }}
            modifiersClassNames={{
              rangeStart: "bg-primary text-primary-foreground rounded-l-md",
              rangeEnd: "bg-primary text-primary-foreground rounded-r-md",
              rangeMiddle: "bg-accent text-accent-foreground rounded-none",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
