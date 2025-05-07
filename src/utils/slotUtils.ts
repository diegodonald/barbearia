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
    const [openHour, openMinute] = open.split(":").map(Number);
    const startTotal = openHour * 60 + openMinute;
    const [endHour, endMinute] = end.split(":").map(Number);
    const endTotal = endHour * 60 + endMinute;
  
    let breakStartTotal = -1, breakEndTotal = -1;
    if (breakStart && breakEnd) {
      const [bsHour, bsMinute] = breakStart.split(":").map(Number);
      breakStartTotal = bsHour * 60 + bsMinute;
      const [beHour, beMinute] = breakEnd.split(":").map(Number);
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
      slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
    
    return slots;
  }
  
  /**
   * Agrupa os slots em períodos do dia (manhã, tarde, noite)
   */
  export function groupSlots(slots: string[]): { manha: string[]; tarde: string[]; noite: string[] } {
    const manha = slots.filter((slot) => slot < "12:00");
    const tarde = slots.filter((slot) => slot >= "12:00" && slot < "17:00");
    const noite = slots.filter((slot) => slot >= "17:00");
    return { manha, tarde, noite };
  }
  
  /**
   * Verifica se os slots são consecutivos e não cruzam intervalos
   */
  export function verificarSlotsConsecutivos(slots: string[]): boolean {
    for (let i = 1; i < slots.length; i++) {
      const [prevHour, prevMin] = slots[i-1].split(":").map(Number);
      const [currHour, currMin] = slots[i].split(":").map(Number);
      
      const prevTotalMins = prevHour * 60 + prevMin;
      const currTotalMins = currHour * 60 + currMin;
      
      if (currTotalMins - prevTotalMins !== 30) {
        return false;
      }
    }
    return true;
  }