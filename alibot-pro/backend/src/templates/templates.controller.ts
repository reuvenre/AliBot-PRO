import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  private uid(req: Request) { return (req.user as any).id; }

  @Get()
  list(@Req() req: Request) {
    return this.svc.list(this.uid(req));
  }

  @Post()
  create(
    @Req() req: Request,
    @Body('name') name: string,
    @Body('content') content: string,
    @Body('icon') icon?: string,
  ) {
    return this.svc.create(this.uid(req), { name, content, icon });
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('content') content?: string,
    @Body('icon') icon?: string,
  ) {
    return this.svc.update(this.uid(req), id, { name, content, icon });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.svc.remove(this.uid(req), id);
  }
}
