import { OperatingHours, Exception } from './common';

export interface ExtendedUser {
  uid: string;
  email: string | null;
  role?: 'admin' | 'barber' | 'user';
  name?: string;
  horarios?: OperatingHours;
  exceptions?: Exception[];
}