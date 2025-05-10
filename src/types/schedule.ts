// src/types/schedule.ts
export interface DayConfig {
  open?: string; // Formato: "HH:MM"
  close?: string; // Formato: "HH:MM"
  breakStart?: string; // Início do intervalo
  breakEnd?: string; // Fim do intervalo
  active: boolean; // Se o dia está ativo
}

export interface OperatingHours {
  domingo: DayConfig;
  segunda: DayConfig;
  terça: DayConfig;
  quarta: DayConfig;
  quinta: DayConfig;
  sexta: DayConfig;
  sábado: DayConfig;
}

export interface Exception {
  id?: string; // Adicionar esta propriedade
  date: string; // Formato: "YYYY-MM-DD"
  status: 'blocked' | 'available'; // Bloqueado ou horário especial
  message?: string; // Mensagem (ex: "Feriado")
  open?: string; // Horário de abertura especial
  close?: string; // Horário de fechamento especial
  breakStart?: string; // Intervalo opcional
  breakEnd?: string; // Intervalo opcional
}

export interface ExtendedUser {
  uid: string;
  email: string | null;
  role?: 'admin' | 'barber' | 'user';
  name?: string;
  // Estes campos serão mantidos para compatibilidade durante a transição
  horarios?: OperatingHours;
  exceptions?: Exception[];
}
