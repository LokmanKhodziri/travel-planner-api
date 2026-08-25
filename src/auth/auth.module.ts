import { Global, Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AdminGuard } from "../common/guards/admin.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GitHubStrategy } from "./github.strategy";
import { GoogleStrategy } from "./google.strategy";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

const oauthProviders = [
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [GoogleStrategy]
    : []),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? [GitHubStrategy]
    : []),
];

@Global()
@Module({
  imports: [PassportModule.register({ session: false })],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    MeService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    AdminGuard,
    ...oauthProviders,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
