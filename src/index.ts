import * as dotenv from "dotenv";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import SpotifyWebApi from "spotify-web-api-node";
import { PrismaClient, User } from "@prisma/client";
import Generator from "./generator";
import cron from "node-cron";

dotenv.config();
const states: string[] = [];
const accountRemoveTokens: string[] = [];

const spotify = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_ID,
  clientSecret: process.env.SPOTIFY_SECRET,
  redirectUri: process.env.REDIRECT_URL,
});

const prisma = new PrismaClient();
const generator = new Generator(prisma);

const fastify = Fastify();
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../assets"),
});

fastify.get("/login", async (req, rep) => {
  const state = makeId(6);
  states.push(state);
  const authUrl = spotify.createAuthorizeURL(
    [
      "playlist-read-private",
      "playlist-read-collaborative",
      "playlist-modify-private",
      "playlist-modify-public",
    ],
    state
  );
  return rep.redirect(authUrl);
});

fastify.get<{ Querystring: { code: string; state: string } }>(
  "/callback",
  async (req, rep) => {
    const state = req.query.state;
    const authCode = req.query.code;
    if (!states.includes(state))
      return rep.status(400).send("Invalid status code");
    states.splice(states.indexOf(state), 1);

    const grantData = await spotify.authorizationCodeGrant(authCode);
    const tokenValidUntil = new Date(
      Date.now() + grantData.body.expires_in * 1000
    );
    const userConnection = new SpotifyWebApi({
      accessToken: grantData.body.access_token,
    });
    const userInfos = await userConnection.getMe();
    const existingUser = await prisma.user.findUnique({
      where: { spotify_id: userInfos.body.id },
    });

    let user: User;
    if (existingUser != null) {
      console.log(
        "Spotify ID",
        userInfos.body.id,
        "[d-" + existingUser.id + "] logged in"
      );
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          access_token: grantData.body.access_token,
          refresh_token: grantData.body.refresh_token,
          token_expires_on: tokenValidUntil,
        },
      });
    } else {
      console.log("Spotify ID", userInfos.body.id, "registered");
      user = await prisma.user.create({
        data: {
          spotify_id: userInfos.body.id,
          refresh_token: grantData.body.refresh_token,
          access_token: grantData.body.access_token,
          token_expires_on: tokenValidUntil,
        },
      });
      generator.generateDailyMusicDrive(user);
    }

    const accountRemoveToken = user.id + "-" + makeId(128);
    accountRemoveTokens.push(accountRemoveToken);

    setTimeout(() => {
      if (accountRemoveTokens.includes(accountRemoveToken))
        accountRemoveTokens.splice(
          accountRemoveTokens.indexOf(accountRemoveToken),
          1
        );
    }, 1000 * 60 * 10);

    return rep.redirect("/success.html?token=" + accountRemoveToken);
  }
);

fastify.get<{ Querystring: { token: string } }>(
  "/remove-account",
  async (req, rep) => {
    const token = req.query.token;
    if (!accountRemoveTokens.includes(token)) {
      return rep
        .status(400)
        .send(
          "Invalid or expired account removal token. Please try again, right after logging in."
        );
    }
    const accountId = token.split("-", 1)[0];
    if (accountId == "" || accountId == null) {
      return rep.status(400).send("Invalid removal token.");
    }
    accountRemoveTokens.splice(accountRemoveTokens.indexOf(token), 1);
    await prisma.user.delete({ where: { id: Number.parseInt(accountId) } });
    console.log("Removed account " + accountId);
    return rep.redirect("/?notice=removed");
  }
);

async function syncAllDailyDrives() {
  console.log("Generating Daily Music Drives for all users");
  const users = await prisma.user.findMany();
  for (const user of users) {
    generator.generateDailyMusicDrive(user);
  }
}

function makeId(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

async function start() {
  console.log("Starting...");
  await prisma.$connect();
  const port = Number.parseInt(process.env.PORT || "3000");
  fastify.listen({ port });
  console.log("Listening on port " + port);
  cron.schedule("0 3 * * *", syncAllDailyDrives);

  if (process.argv.includes("--sync-now")) {
    syncAllDailyDrives();
  }
}

start();
