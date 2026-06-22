import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { UsersService } from './users.service';

/** Admin-only views. Guarded by JWT + admin role. */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  listUsers() {
    return this.users.listAll();
  }

  @Get('stats')
  stats() {
    return this.users.adminStats();
  }
}
