export interface DayConfig {
  open?: string;
  breakStart?: string;
  breakEnd?: string;
  close?: string;
  active: boolean;
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
  id?: string;
  date: string;
  status: 'blocked' | 'available';
  message?: string;
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface ExtendedUser {
  uid: string;
  email: string | null;
  role?: 'admin' | 'barber' | 'user';
  name?: string;
  horarios?: OperatingHours;
  exceptions?: Exception[];
}

export interface Agendamento {
  id: string;
  dateStr: string;
  timeSlot?: string;
  timeSlots?: string[];
  duration?: number;
  service: string;
  barber: string;
  barberId: string;
  name: string;
  status: string;
  uid: string;
  email?: string;
  createdAt?: Date;
}