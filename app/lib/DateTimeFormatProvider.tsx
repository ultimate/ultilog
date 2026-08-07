"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultDateFormat, defaultTimeFormat, formatStoredDate, formatStoredDateTime, formatStoredTime, type DateFormat, type TimeFormat } from "./date-time-format";
import { useI18n } from "./i18n";

type DateTimeFormatContextValue = {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
};

const DateTimeFormatContext = createContext<DateTimeFormatContextValue>({ dateFormat: defaultDateFormat, timeFormat: defaultTimeFormat });

export function DateTimeFormatProvider({ dateFormat, timeFormat, children }: DateTimeFormatContextValue & { children: ReactNode }) {
  return <DateTimeFormatContext.Provider value={{ dateFormat, timeFormat }}>{children}</DateTimeFormatContext.Provider>;
}

export function useDateTimeFormat() {
  const { dateFormat, timeFormat } = useContext(DateTimeFormatContext);
  const { locale } = useI18n();
  return {
    dateFormat,
    timeFormat,
    formatDate: (value?: string | null) => formatStoredDate(value, dateFormat, locale),
    formatTime: (value?: string | null) => formatStoredTime(value, timeFormat),
    formatDateTime: (value?: string | null) => formatStoredDateTime(value, dateFormat, timeFormat, locale),
  };
}
