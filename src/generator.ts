import { PrismaClient, User } from "@prisma/client";
import SpotifyWebApi from "spotify-web-api-node";
import imageStore from "./imageStore";

export default class Generator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async generateDailyMusicDrive(user: User) {
    const startTime = Date.now();

    console.log(
      "[u-" + user.id + "] Generating Daily Music Drive for user:",
      user.id
    );

    const spotify = new SpotifyWebApi({
      accessToken: user.access_token,
      refreshToken: user.refresh_token,
    });
    if (Date.now() >= user.token_expires_on.getTime() - 5000) {
      console.log("[u-" + user.id + "] Refresh access tokens");
      const tokenData = await spotify.refreshAccessToken();
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          access_token: tokenData.body.access_token,
          refresh_token: tokenData.body.refresh_token,
          token_expires_on: new Date(
            Date.now() + tokenData.body.expires_in * 1000
          ),
        },
      });
    }

    if (user.daily_music_drive_id == null) {
      console.log(
        "[u-" +
          user.id +
          "] Creating Daily Music Drive playlist in Spotify account"
      );
      const playlistData = await spotify.createPlaylist("Daily Music Drive", {
        description: "Spotify's Daily Drive without podcasts",
      });
      console.log("[u-" + user.id + "] Uploading playlist cover");
      await spotify.uploadCustomPlaylistCoverImage(
        playlistData.body.id,
        imageStore.dailyMusicDrive
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { daily_music_drive_id: playlistData.body.id },
      });
      user.daily_music_drive_id = playlistData.body.id;
    }

    const searchResultData = await spotify.searchPlaylists("Daily Drive");
    const dailyDrivePlaylist: SpotifyApi.PlaylistObjectSimplified =
      searchResultData.body.playlists.items.find(
        (playlist: SpotifyApi.PlaylistObjectSimplified) =>
          playlist.name == "Daily Drive" && playlist.owner.id == "spotify"
      );

    console.log("[u-" + user.id + "] Removing old tracks");
    const dailyMusicDriveTracks = (
      await spotify.getPlaylistTracks(user.daily_music_drive_id)
    ).body.items.map((track) => track.track);
    while (dailyMusicDriveTracks.length > 0) {
      const tracksToRemove = dailyMusicDriveTracks.splice(0, 5);
      await spotify.removeTracksFromPlaylist(
        user.daily_music_drive_id,
        tracksToRemove
      );
    }

    console.log("[d-" + user.id + "] Adding new tracks");
    const dailyDriveTracks = (
      await spotify.getPlaylistTracks(dailyDrivePlaylist.id)
    ).body.items
      .filter((track) => track.track.type == "track")
      .map((track) => track.track.uri);
    await spotify.addTracksToPlaylist(
      user.daily_music_drive_id,
      dailyDriveTracks
    );

    console.log(
      "[d-" +
        user.id +
        "] Done (" +
        Math.round((Date.now() - startTime + Number.EPSILON) / 10) / 100 +
        "s)."
    );
  }
}
