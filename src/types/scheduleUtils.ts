// src/utils/scheduleUtils.ts
import { OperatingHours, DayConfig, Exception } from '@/types/schedule';
import { format, addMinutes, isBefore, parse } from 'date-fns';

// Função para verificar se uma data tem alguma exceção
export function getExceptionForDate(
  exceptions: Exception[] | undefined,
  dateStr: string
): Exception | null {
  if (!exceptions || exceptions.length === 0) return null;
  return exceptions.find(ex => ex.date === dateStr) || null;
}

// Função para obter a configuração de horário para um dia específico
export function getDayConfig(
  operatingHours: OperatingHours | null,
  dayName: keyof OperatingHours,
  exceptions: Exception[] | undefined,
  dateStr: string
): { config: DayConfig | null; isException: boolean } {
  // Verificar se há uma exceção para esta data
  const exception = getExceptionForDate(exceptions, dateStr);

  if (exception) {
    if (exception.status === 'blocked') {
      return {
        config: { active: false },
        isException: true,
      };
    } else {
      return {
        config: {
          active: true,
          open: exception.open,
          close: exception.close,
          breakStart: exception.breakStart,
          breakEnd: exception.breakEnd,
        },
        isException: true,
      };
    }
  }

  // Se não houver exceção, usar a configuração padrão
  if (!operatingHours) {
    return { config: null, isException: false };
  }

  return {
    config: operatingHours[dayName],
    isException: false,
  };
}

// Função para gerar slots de horário com base na configuração do dia
export function generateTimeSlots(
  config: DayConfig,
  dateStr: string,
  slotDurationMinutes: number = 30,
  bookedSlots: string[] = []
): { slot: string; available: boolean }[] {
  if (!config || !config.active || !config.open || !config.close) {
    return [];
  }

  const slots: { slot: string; available: boolean }[] = [];

  // Converter strings para objetos Date
  const startTime = parse(config.open, 'HH:mm', new Date());
  const endTime = parse(config.close, 'HH:mm', new Date());

  let breakStart, breakEnd;
  if (config.breakStart && config.breakEnd) {
    breakStart = parse(config.breakStart, 'HH:mm', new Date());
    breakEnd = parse(config.breakEnd, 'HH:mm', new Date());
  }

  // Gerar slots
  let currentSlot = startTime;
  while (isBefore(currentSlot, endTime)) {
    const timeString = format(currentSlot, 'HH:mm');

    // Verificar se está no intervalo
    const isDuringBreak =
      breakStart &&
      breakEnd &&
      !isBefore(currentSlot, breakStart) &&
      isBefore(currentSlot, breakEnd);

    // Verificar se já está reservado
    const isBooked = bookedSlots.includes(timeString);

    // Só adicionar se estiver disponível (não em intervalo e não reservado)
    const isAvailable = !isDuringBreak && !isBooked;

    slots.push({
      slot: timeString,
      available: isAvailable,
    });

    currentSlot = addMinutes(currentSlot, slotDurationMinutes);
  }

  return slots;
}
