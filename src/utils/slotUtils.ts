import { DayConfig, OperatingHours, Exception } from '@/types/common';

/**
 * Gera slots de tempo com base nos horários de abertura, fechamento e intervalo
 */
export function generateSlots(
  open: string,
  breakStart: string | undefined,
  breakEnd: string | undefined,
  end: string,
  interval: number
): string[] {
  const [openHour, openMinute] = open.split(':').map(Number);
  const startTotal = openHour * 60 + openMinute;
  const [endHour, endMinute] = end.split(':').map(Number);
  const endTotal = endHour * 60 + endMinute;

  let breakStartTotal = -1,
    breakEndTotal = -1;
  if (breakStart && breakEnd) {
    const [bsHour, bsMinute] = breakStart.split(':').map(Number);
    breakStartTotal = bsHour * 60 + bsMinute;
    const [beHour, beMinute] = breakEnd.split(':').map(Number);
    breakEndTotal = beHour * 60 + beMinute;
  }

  const slots: string[] = [];

  for (let time = startTotal; time < endTotal - interval + 1; time += interval) {
    if (breakStartTotal >= 0 && breakEndTotal > 0) {
      const slotEnd = time + interval;
      if (
        (time >= breakStartTotal && time < breakEndTotal) ||
        (slotEnd > breakStartTotal && slotEnd <= breakEndTotal) ||
        (time < breakStartTotal && slotEnd > breakEndTotal)
      ) {
        continue;
      }
    }

    const hour = Math.floor(time / 60);
    const minute = time % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }

  return slots;
}

/**
 * Agrupa os slots em períodos do dia (manhã, tarde, noite)
 */
export function groupSlots(slots: string[]): { manha: string[]; tarde: string[]; noite: string[] } {
  const manha = slots.filter(slot => slot < '12:00');
  const tarde = slots.filter(slot => slot >= '12:00' && slot < '17:00');
  const noite = slots.filter(slot => slot >= '17:00');
  return { manha, tarde, noite };
}

/**
 * Verifica se os slots são consecutivos e não cruzam intervalos
 */
export function verificarSlotsConsecutivos(slots: string[]): boolean {
  for (let i = 1; i < slots.length; i++) {
    const [prevHour, prevMin] = slots[i - 1].split(':').map(Number);
    const [currHour, currMin] = slots[i].split(':').map(Number);

    const prevTotalMins = prevHour * 60 + prevMin;
    const currTotalMins = currHour * 60 + currMin;

    if (currTotalMins - prevTotalMins !== 30) {
      return false;
    }
  }
  return true;
}

// Função auxiliar para converter "YYYY-MM-DD" para "DD/MM/YYYY"
export const formatDate = (dateStr: string): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Função auxiliar que retorna a data no formato "YYYY-MM-DD" usando o horário local
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

// Função para obter o nome do dia da semana
export function getDayName(date: Date): keyof OperatingHours {
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  return days[date.getDay()] as keyof OperatingHours;
}

// Função para obter configuração efetiva do dia
export function getEffectiveDayConfig(
  date: Date,
  operatingHours: OperatingHours,
  exceptions: Exception[]
): DayConfig | null {
  const dayName = getDayName(date);
  const normalizedDate = getLocalDateString(date);

  // Verifica exceções
  const exception = exceptions.find(ex => ex.date === normalizedDate);
  if (exception) {
    if (exception.status === 'blocked') {
      return null;
    }
    if (exception.status === 'available' && exception.open && exception.close) {
      return {
        open: exception.open,
        close: exception.close,
        breakStart: exception.breakStart,
        breakEnd: exception.breakEnd,
        active: true,
      };
    }
  }

  // Usa a configuração padrão do dia
  const dayConfig = operatingHours[dayName];
  return dayConfig && dayConfig.active && dayConfig.open && dayConfig.close ? dayConfig : null;
}
