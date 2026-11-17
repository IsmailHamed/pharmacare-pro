// src/domain/repositories/IUserRepository.ts
import { UserEntity } from "../entities/User";

export interface IUserRepository {
  getAllUsers(): Promise<UserEntity[]>;
  getUserById(id: string): Promise<UserEntity | null>;
  getUserByPin(pinCode: string): Promise<UserEntity | null>;
  upsertUser(user: UserEntity): Promise<void>;
  toggleUserStatus(id: string, isActive: boolean): Promise<void>;
}
