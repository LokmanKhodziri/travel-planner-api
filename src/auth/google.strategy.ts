import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-google-oauth20";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      callbackURL: `${process.env.API_URL ?? "http://localhost:4000"}/auth/google/callback`,
    });
    this.prisma = prisma;
  }

  private readonly prisma: PrismaService;

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      displayName?: string;
      photos?: { value: string }[];
      emails?: { value: string }[];
    },
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error("No email from Google");
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.displayName ?? null,
          image: profile.photos?.[0]?.value ?? null,
        },
      });
    }
    return { id: user.id };
  }
}
