export interface DayConfig {
  open?: string;
  close?: string;
  breakStart?: string;
  breakEnd?: string;
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