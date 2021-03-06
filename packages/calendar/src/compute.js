/*
 * This file is part of the nivo project.
 *
 * Copyright 2016-present, Raphaël Benitte.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import memoize from 'lodash.memoize'
import isDate from 'lodash.isdate'
import range from 'lodash.range'
import { alignBox } from '@nivo/core'
import { timeFormat } from 'd3-time-format'
import {
    timeDays,
    timeMonths,
    timeYear,
    timeMonday,
    timeTuesday,
    timeWednesday,
    timeThursday,
    timeFriday,
    timeSaturday,
    timeSunday,
} from 'd3-time'

/**
 * Compute min/max values.
 *
 * @param {Array<>}       data
 * @param {number|'auto'} minSpec - Define the strategy to use to compute min value, if number, it will be used, if 'auto', will use the lower value from the dataset
 * @param {number|'auto'} maxSpec - Define the strategy to use to compute max value, if number, it will be used, if 'auto', will use the higher value from the dataset
 * @return {[number, string]}
 */
export const computeDomain = (data, minSpec, maxSpec) => {
    const allValues = data.map(d => d.value)
    const minValue = minSpec === 'auto' ? Math.min(...allValues) : minSpec
    const maxValue = maxSpec === 'auto' ? Math.max(...allValues) : maxSpec

    return [minValue, maxValue]
}

/**
 * Compute day cell size according to current context.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} direction
 * @param {array}  yearRange
 * @param {number} yearSpacing
 * @param {number} daySpacing
 * @param {number} maxWeeks
 * @returns {number}
 */
const computeCellSize = ({
    width,
    height,
    direction,
    yearRange,
    yearSpacing,
    daySpacing,
    maxWeeks,
}) => {
    let hCellSize
    let vCellSize

    if (direction === 'horizontal') {
        hCellSize = (width - daySpacing * maxWeeks) / maxWeeks
        vCellSize =
            (height - (yearRange.length - 1) * yearSpacing - yearRange.length * (8 * daySpacing)) /
            (yearRange.length * 7)
    } else {
        hCellSize =
            (width - (yearRange.length - 1) * yearSpacing - yearRange.length * (8 * daySpacing)) /
            (yearRange.length * 7)
        vCellSize = (height - daySpacing * maxWeeks) / maxWeeks
    }

    return Math.min(hCellSize, vCellSize)
}

export const getDayIndex = (date, firstDayOfWeek) => {
    const days = [0, 1, 2, 3, 4, 5, 6]
    const day = date.getDay()
    const offsetDay = day - firstDayOfWeek
    const [dayIndex] = days.slice(offsetDay)
    return dayIndex
}

const getTimeInterval = firstDayOfWeek => {
    switch (firstDayOfWeek) {
        case 0:
        default:
            return timeSunday
        case 1:
            return timeMonday
        case 2:
            return timeTuesday
        case 3:
            return timeWednesday
        case 4:
            return timeThursday
        case 5:
            return timeFriday
        case 6:
            return timeSaturday
    }
}

/**
 * Computes month path and bounding box.
 *
 * @param {Date}   date
 * @param {number} cellSize
 * @param {number} yearIndex
 * @param {number} yearSpacing
 * @param {number} daySpacing
 * @param {string} direction
 * @param {number} originX
 * @param {number} originY
 * @param {number} firstDayOfWeek
 * @returns { { path: string, bbox: { x: number, y: number, width: number, height: number } } }
 */
const monthPathAndBBox = ({
    date,
    cellSize,
    yearIndex,
    yearSpacing,
    daySpacing,
    direction,
    originX,
    originY,
    firstDayOfWeek,
}) => {
    // first day of next month
    const t1 = new Date(date.getFullYear(), date.getMonth() + 1, 0)

    // ranges
    const timeInterval = getTimeInterval(firstDayOfWeek)
    const firstWeek = timeInterval.count(timeYear(date), date)
    const lastWeek = timeInterval.count(timeYear(t1), t1)
    const firstDay = getDayIndex(date, firstDayOfWeek)
    const lastDay = getDayIndex(t1, firstDayOfWeek)

    // offset according to year index
    let xO = originX
    let yO = originY
    const yearOffset = yearIndex * (7 * (cellSize + daySpacing) + yearSpacing)
    if (direction === 'horizontal') {
        yO += yearOffset
    } else {
        xO += yearOffset
    }

    let path
    let bbox = { x: xO, y: yO, width: 0, height: 0 }
    if (direction === 'horizontal') {
        path = [
            `M${xO + (firstWeek + 1) * (cellSize + daySpacing)},${yO +
                firstDay * (cellSize + daySpacing)}`,
            `H${xO + firstWeek * (cellSize + daySpacing)}V${yO + 7 * (cellSize + daySpacing)}`,
            `H${xO + lastWeek * (cellSize + daySpacing)}V${yO +
                (lastDay + 1) * (cellSize + daySpacing)}`,
            `H${xO + (lastWeek + 1) * (cellSize + daySpacing)}V${yO}`,
            `H${xO + (firstWeek + 1) * (cellSize + daySpacing)}Z`,
        ].join('')

        bbox.x = xO + firstWeek * (cellSize + daySpacing)
        bbox.width = xO + (lastWeek + 1) * (cellSize + daySpacing) - bbox.x
        bbox.height = 7 * (cellSize + daySpacing)
    } else {
        path = [
            `M${xO + firstDay * (cellSize + daySpacing)},${yO +
                (firstWeek + 1) * (cellSize + daySpacing)}`,
            `H${xO}V${yO + (lastWeek + 1) * (cellSize + daySpacing)}`,
            `H${xO + (lastDay + 1) * (cellSize + daySpacing)}V${yO +
                lastWeek * (cellSize + daySpacing)}`,
            `H${xO + 7 * (cellSize + daySpacing)}V${yO + firstWeek * (cellSize + daySpacing)}`,
            `H${xO + firstDay * (cellSize + daySpacing)}Z`,
        ].join('')

        bbox.y = yO + firstWeek * (cellSize + daySpacing)
        bbox.width = 7 * (cellSize + daySpacing)
        bbox.height = yO + (lastWeek + 1) * (cellSize + daySpacing) - bbox.y
    }

    return { path, bbox }
}

/**
 * Creates a memoized version of monthPathAndBBox function.
 */
const memoMonthPathAndBBox = memoize(
    monthPathAndBBox,
    ({
        date,
        cellSize,
        yearIndex,
        yearSpacing,
        daySpacing,
        direction,
        originX,
        originY,
        firstDayOfWeek,
    }) => {
        return `${date.toString()}.${cellSize}.${yearIndex}.${yearSpacing}.${daySpacing}.${direction}.${originX}.${originY}.${firstDayOfWeek}`
    }
)

/**
 * Returns a function to Compute day cell position for horizontal layout.
 *
 * @param {number} cellSize
 * @param {number} yearSpacing
 * @param {number} daySpacing
 * @param {number} firstDayOfWeek
 * @returns { function(): { x: number, y: number } }
 */
const cellPositionHorizontal = (cellSize, yearSpacing, daySpacing, firstDayOfWeek) => {
    return (originX, originY, d, yearIndex) => {
        const timeInterval = getTimeInterval(firstDayOfWeek)
        const weekOfYear = timeInterval.count(timeYear(d), d)

        return {
            x: originX + weekOfYear * (cellSize + daySpacing) + daySpacing / 2,
            y:
                originY +
                getDayIndex(d, firstDayOfWeek) * (cellSize + daySpacing) +
                daySpacing / 2 +
                yearIndex * (yearSpacing + 7 * (cellSize + daySpacing)),
        }
    }
}

/**
 * Returns a function to Compute day cell position for vertical layout.
 *
 * @param {number} cellSize
 * @param {number} yearSpacing
 * @param {number} daySpacing
 * @param {number} firstDayOfWeek
 * @returns { function(): { x: number, y: number } }
 */
const cellPositionVertical = (cellSize, yearSpacing, daySpacing, firstDayOfWeek) => {
    return (originX, originY, d, yearIndex) => {
        const timeInterval = getTimeInterval(firstDayOfWeek)
        const weekOfYear = timeInterval.count(timeYear(d), d)

        return {
            x:
                originX +
                getDayIndex(d, firstDayOfWeek) * (cellSize + daySpacing) +
                daySpacing / 2 +
                yearIndex * (yearSpacing + 7 * (cellSize + daySpacing)),
            y: originY + weekOfYear * (cellSize + daySpacing) + daySpacing / 2,
        }
    }
}

// used for days range and data matching
const dayFormat = timeFormat('%Y-%m-%d')

/**
 * Compute base layout, without caring about the current data.
 *
 * @param {number}      width
 * @param {number}      height
 * @param {string|Date} from
 * @param {string|Date} to
 * @param {string}      direction
 * @param {number}      yearSpacing
 * @param {number}      daySpacing
 * @param {string}      align
 * @param {number}      firstDayOfWeek
 * @returns {object}
 */
export const computeLayout = ({
    width,
    height,
    from,
    to,
    direction,
    yearSpacing,
    daySpacing,
    align,
    firstDayOfWeek,
}) => {
    const fromDate = isDate(from) ? from : new Date(from)
    const toDate = isDate(to) ? to : new Date(to)

    let yearRange = range(fromDate.getFullYear(), toDate.getFullYear() + 1)
    const timeIntervalRange = getTimeInterval(firstDayOfWeek).range
    const maxWeeks =
        Math.max(
            ...yearRange.map(
                year => timeIntervalRange(new Date(year, 0, 1), new Date(year + 1, 0, 1)).length
            )
        ) + 1

    const cellSize = computeCellSize({
        width,
        height,
        direction,
        yearRange,
        yearSpacing,
        daySpacing,
        maxWeeks,
    })

    const monthsSize = cellSize * maxWeeks + daySpacing * maxWeeks
    const yearsSize =
        (cellSize + daySpacing) * 7 * yearRange.length + yearSpacing * (yearRange.length - 1)

    const calendarWidth = direction === 'horizontal' ? monthsSize : yearsSize
    const calendarHeight = direction === 'horizontal' ? yearsSize : monthsSize
    const [originX, originY] = alignBox(
        {
            x: 0,
            y: 0,
            width: calendarWidth,
            height: calendarHeight,
        },
        {
            x: 0,
            y: 0,
            width,
            height,
        },
        align
    )

    let cellPosition
    if (direction === 'horizontal') {
        cellPosition = cellPositionHorizontal(cellSize, yearSpacing, daySpacing, firstDayOfWeek)
    } else {
        cellPosition = cellPositionVertical(cellSize, yearSpacing, daySpacing, firstDayOfWeek)
    }

    let years = []
    let months = []
    let days = []

    yearRange.forEach((year, i) => {
        const yearStart = new Date(year, 0, 1)
        const yearEnd = new Date(year + 1, 0, 1)

        days = days.concat(
            timeDays(yearStart, yearEnd).map(dayDate => {
                return {
                    date: dayDate,
                    day: dayFormat(dayDate),
                    size: cellSize,
                    ...cellPosition(originX, originY, dayDate, i),
                }
            })
        )

        const yearMonths = timeMonths(yearStart, yearEnd).map(monthDate => ({
            date: monthDate,
            year: monthDate.getFullYear(),
            month: monthDate.getMonth(),
            ...memoMonthPathAndBBox({
                originX,
                originY,
                date: monthDate,
                direction,
                yearIndex: i,
                yearSpacing,
                daySpacing,
                cellSize,
                firstDayOfWeek,
            }),
        }))

        months = months.concat(yearMonths)

        years.push({
            year,
            bbox: {
                x: yearMonths[0].bbox.x,
                y: yearMonths[0].bbox.y,
                width: yearMonths[11].bbox.x - yearMonths[0].bbox.x + yearMonths[11].bbox.width,
                height: yearMonths[11].bbox.y - yearMonths[0].bbox.y + yearMonths[11].bbox.height,
            },
        })
    })

    return { years, months, days, cellSize, calendarWidth, calendarHeight, originX, originY }
}

/**
 * Bind current data to computed day cells.
 *
 * @param {array}  days
 * @param {array}  data
 * @param {object} colorScale
 * @param {string} emptyColor
 * @returns {Array}
 */
export const bindDaysData = ({ days, data, colorScale, emptyColor }) => {
    return days.map(day => {
        day.color = emptyColor
        data.forEach(dayData => {
            if (dayData.day === day.day) {
                day.value = dayData.value
                day.color = colorScale(dayData.value)
                day.data = dayData
            }
        })

        return day
    })
}

export const computeYearLegendPositions = ({ years, direction, position, offset }) => {
    return years.map(year => {
        let x = 0
        let y = 0
        let rotation = 0
        if (direction === 'horizontal' && position === 'before') {
            x = year.bbox.x - offset
            y = year.bbox.y + year.bbox.height / 2
            rotation = -90
        } else if (direction === 'horizontal' && position === 'after') {
            x = year.bbox.x + year.bbox.width + offset
            y = year.bbox.y + year.bbox.height / 2
            rotation = -90
        } else if (direction === 'vertical' && position === 'before') {
            x = year.bbox.x + year.bbox.width / 2
            y = year.bbox.y - offset
        } else {
            x = year.bbox.x + year.bbox.width / 2
            y = year.bbox.y + year.bbox.height + offset
        }

        return {
            ...year,
            x,
            y,
            rotation,
        }
    })
}

export const computeMonthLegendPositions = ({ months, direction, position, offset }) => {
    return months.map(month => {
        let x = 0
        let y = 0
        let rotation = 0
        if (direction === 'horizontal' && position === 'before') {
            x = month.bbox.x + month.bbox.width / 2
            y = month.bbox.y - offset
        } else if (direction === 'horizontal' && position === 'after') {
            x = month.bbox.x + month.bbox.width / 2
            y = month.bbox.y + month.bbox.height + offset
        } else if (direction === 'vertical' && position === 'before') {
            x = month.bbox.x - offset
            y = month.bbox.y + month.bbox.height / 2
            rotation = -90
        } else {
            x = month.bbox.x + month.bbox.width + offset
            y = month.bbox.y + month.bbox.height / 2
            rotation = -90
        }

        return {
            ...month,
            x,
            y,
            rotation,
        }
    })
}
