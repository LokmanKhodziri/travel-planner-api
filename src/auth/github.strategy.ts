import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-github2";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(prisma: PrismaService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      callbackURL: `${process.env.API_URL ?? "http://localhost:4000"}/auth/github/callback`,
    });
    this.prisma = prisma;
  }

  private readonly prisma: PrismaService;

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      displayName?: string;
      photos?: { value: string }[];
      emails?: { value: string }[];
    },
  ) {
    const email = profile.emails?.[0]?.value ?? `${profile.id}@github.user`;
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
