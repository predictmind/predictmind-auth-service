import { JwtPayload } from "../auth/auth.service";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
