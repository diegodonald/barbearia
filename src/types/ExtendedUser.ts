import { User } from "firebase/auth";

export interface ExtendedUser extends User {
  role?: string;
}