import { OperatingHours, DayConfig, Exception } from '@/types/common';

/**
 * Converte uma data para o formato "YYYY-MM-DD"
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma string de data do formato "YYYY-MM-DD" para "DD/MM/YYYY"
 */
export function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Retorna o nome do dia da semana de uma data
 */
export function getDayName(date: Date): keyof OperatingHours {
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[date.getDay()] as keyof OperatingHours;
}

/**
 * Obtém a configuração efetiva para um determinado dia, considerando exceções
 */
export function getEffectiveDayConfig(
  barberHorarios: OperatingHours | null,
  barberExceptions: Exception[] | undefined,
  date: Date,
  globalOperatingHours: OperatingHours | null,
  globalExceptions: Exception[] | undefined
): DayConfig | null {
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);

  // Verifica exceções individuais do barbeiro
  if (barberExceptions && barberExceptions.length > 0) {
    const exception = barberExceptions.find(ex => ex.date === normalizedDate);
    if (exception) {
      if (exception.status === "blocked") {
        return null;
      }
      if (exception.status === "available" && exception.open && exception.close) {
        return { 
          open: exception.open, 
          close: exception.close, 
          breakStart: exception.breakStart,
          breakEnd: exception.breakEnd,
          active: true 
        };
      }
    }
  }

  // Verifica exceções globais
  if (globalExceptions && globalExceptions.length > 0) {
    const exception = globalExceptions.find(ex => ex.date === normalizedDate);
    if (exception) {
      if (exception.status === "blocked") {
        return null;
      }
      if (exception.status === "available" && exception.open && exception.close) {
        return { 
          open: exception.open, 
          close: exception.close,
          breakStart: exception.breakStart,
          breakEnd: exception.breakEnd,
          active: true 
        };
      }
    }
  }

  // Usa configuração individual, se disponível
  if (barberHorarios && barberHorarios[dayName]) {
    const config = barberHorarios[dayName];
    return config && config.active && config.open && config.close ? config : null;
  }

  // Caso contrário, usa a configuração global
  if (globalOperatingHours) {
    const config = globalOperatingHours[dayName];
    return config && config.active && config.open && config.close ? config : null;
  }

  return null;
}