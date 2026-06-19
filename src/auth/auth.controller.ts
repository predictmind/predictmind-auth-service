import { Controller, Get } from "@nestjs/common";

// Authentication, users and RBAC
@Controller("auth")
export class AuthController {
  @Get()
  info(): { service: string; description: string } {
    return {
      service: "auth",
      description: "Authentication, users and RBAC",
    };
  }
}